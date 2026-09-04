import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import {
  declararCiotSchema,
  consultarSituacaoTransportadorSchema,
} from "../../schemas/fiscalSchema.js";
import { somenteDigitos, gerarIdOperacaoUnico } from "../../utils/fiscalDocs.js";
import { CiotProviderClient } from "./CiotProviderClient.js";
import {
  assertTenantFk,
  findOwnedOr404,
  resolveEmpresaCertificado,
} from "./fiscalShared.js";
import { resultadoSimulacaoDocumento } from "./fiscalSimulacao.js";

// Código de sucesso documentado pela ANTT para a declaração. Os demais
// endpoints não têm código de sucesso confirmado — assume-se o mesmo 110 até
// validar em teste real (mesma ressalva do jwsoft).
const CODIGO_SUCESSO_OPERACAO = 110;
// Regra B34: cancelamento só até 24h após o início da viagem declarada.
const JANELA_CANCELAMENTO_HORAS = 24;

// Janela de cancelamento (horas) por categoria de operação (item 3.2). Hoje
// TODAS usam as mesmas 24h da regra B34 — o mapa é só o ponto único para
// ajustar prazo/retificação por categoria quando as regras forem confirmadas.
const JANELA_CANCELAMENTO_HORAS_POR_CATEGORIA = {
  lotacao: JANELA_CANCELAMENTO_HORAS,
  fracionada: JANELA_CANCELAMENTO_HORAS,
  tac_agregado: JANELA_CANCELAMENTO_HORAS,
};

/** Mapeia tipo_operacao (1/2/3) para a categoria explícita (item 3.2). */
const CATEGORIA_POR_TIPO_OPERACAO = {
  1: "lotacao",
  2: "fracionada",
  3: "tac_agregado",
};

/**
 * Resolve a categoria da operação (3.2): usa `categoria_operacao` do corpo
 * quando informada, senão deriva de `tipo_operacao`.
 */
export function resolverCategoriaOperacao(dto) {
  return (
    dto.categoria_operacao ??
    CATEGORIA_POR_TIPO_OPERACAO[dto.tipo_operacao] ??
    null
  );
}

/** Janela de cancelamento (horas) para uma categoria — 24h por padrão. */
export function janelaCancelamentoHoras(categoria) {
  return (
    JANELA_CANCELAMENTO_HORAS_POR_CATEGORIA[categoria] ??
    JANELA_CANCELAMENTO_HORAS
  );
}

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

function validarCnpjCertificado(cnpjEmpresa, contratado, contratante) {
  const cert = somenteDigitos(cnpjEmpresa);
  if (
    cert !== somenteDigitos(contratado) &&
    cert !== somenteDigitos(contratante)
  ) {
    throw badRequest(
      "O CNPJ da empresa fiscal (certificado usado na conexão) precisa ser o contratado ou o contratante da operação",
    );
  }
}

/**
 * Piso mínimo de frete (item 3.3). Bloqueio explícito: exige piso informado
 * positivo e frete não inferior ao piso.
 *
 * TODO: consultar automaticamente o piso mínimo da ANTT (Política Nacional de
 * Pisos Mínimos do Transporte Rodoviário de Cargas — Lei 13.703/2018 e
 * resoluções ANTT). Enquanto não há consulta automática, não se inventa o
 * valor: bloqueia quando o piso não é informado (<= 0) ou quando o frete fica
 * abaixo do piso informado pelo usuário.
 */
export function verificarPisoMinimoFrete(dto) {
  if (!(Number(dto.valor_piso_minimo_frete) > 0)) {
    throw badRequest(
      "Piso mínimo de frete (ANTT) não informado. A consulta automática ao " +
        "piso ainda não está disponível — informe valor_piso_minimo_frete " +
        "calculado conforme a tabela ANTT vigente para a operação.",
    );
  }
  if (Number(dto.valor_frete) < Number(dto.valor_piso_minimo_frete)) {
    throw badRequest(
      "O valor do frete está abaixo do piso mínimo ANTT informado " +
        `(frete ${dto.valor_frete} < piso ${dto.valor_piso_minimo_frete}).`,
    );
  }
}

/**
 * Colunas do snapshot da situação do RNTRC do contratado (item 3.1). Só usa o
 * que veio no corpo da declaração — nenhuma consulta automática à ANTT nesta
 * rodada. `rntrc_contratado_snapshot` (JSONB) só entra quando há valor, para
 * não gravar null cru em campo Json.
 */
export function colunasRntrcSnapshot(dto) {
  const temAlgo =
    dto.rntrc_contratado_situacao != null ||
    dto.rntrc_contratado_snapshot != null;
  const cols = {
    rntrc_contratado_situacao: dto.rntrc_contratado_situacao ?? null,
    rntrc_contratado_situacao_em: temAlgo ? new Date() : null,
  };
  if (dto.rntrc_contratado_snapshot != null) {
    cols.rntrc_contratado_snapshot = dto.rntrc_contratado_snapshot;
  }
  return cols;
}

/**
 * Retenções do comprovante de pagamento do CIOT (item 3.3): INSS e SEST/SENAT.
 * NADA de percentual hardcoded — a alíquota vem do corpo da declaração
 * (`dto.retencoes.*_aliquota`) ou da config (FISCAL_CIOT_RETENCAO_*_ALIQUOTA).
 * Sem alíquota, a retenção fica toda null e não entra no comprovante. Alíquota
 * como fração (0.022 = 2,2%). Função pura (recebe a config por parâmetro).
 *
 * @param {object} dto
 * @param {{ inssAliquota?: number|null, sestSenatAliquota?: number|null }} [cfg]
 */
export function calcularRetencoes(dto, cfg = {}) {
  const r = dto.retencoes ?? {};
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const inssAliq = r.inss_aliquota ?? cfg.inssAliquota ?? null;
  const sestAliq = r.sest_senat_aliquota ?? cfg.sestSenatAliquota ?? null;
  const temAliquota = inssAliq != null || sestAliq != null;
  const base = r.base ?? (temAliquota ? (dto.valor_frete ?? null) : null);
  const inssValor =
    r.inss_valor ??
    (base != null && inssAliq != null ? round2(base * inssAliq) : null);
  const sestValor =
    r.sest_senat_valor ??
    (base != null && sestAliq != null ? round2(base * sestAliq) : null);
  return {
    retencao_base: base,
    retencao_inss_aliquota: inssAliq,
    retencao_inss_valor: inssValor,
    retencao_sest_senat_aliquota: sestAliq,
    retencao_sest_senat_valor: sestValor,
  };
}

/** Bloco Retencoes do payload do provedor, ou undefined quando não há retenção. */
export function montarRetencoesPayload(retencoes) {
  if (
    retencoes.retencao_inss_valor == null &&
    retencoes.retencao_sest_senat_valor == null
  ) {
    return undefined;
  }
  return {
    BaseCalculo: retencoes.retencao_base ?? undefined,
    INSS: {
      Aliquota: retencoes.retencao_inss_aliquota ?? undefined,
      Valor: retencoes.retencao_inss_valor ?? undefined,
    },
    SestSenat: {
      Aliquota: retencoes.retencao_sest_senat_aliquota ?? undefined,
      Valor: retencoes.retencao_sest_senat_valor ?? undefined,
    },
  };
}

/**
 * Validação compartilhada da declaração real e da simulação.
 * A simulação não exige certificado A1 (mTLS) — só carrega a empresa.
 */
async function prepararDeclaracao(tenantId, body, { exigirCertificado = true } = {}) {
  const dto = declararCiotSchema.parse(body);
  let empresa;
  let certificado = null;
  if (exigirCertificado) {
    ({ empresa, certificado } = await resolveEmpresaCertificado(
      tenantId,
      dto.fiscal_empresa_id,
    ));
  } else {
    empresa = await findOwnedOr404(
      "fiscal_empresas",
      dto.fiscal_empresa_id,
      tenantId,
      "Empresa fiscal",
    );
  }
  const caminhaoId = await assertTenantFk(
    "caminhoes",
    dto.caminhao_id,
    tenantId,
    "Caminhão",
    { optional: true },
  );
  const motoristaId = await assertTenantFk(
    "motoristas",
    dto.motorista_id,
    tenantId,
    "Motorista",
    { optional: true },
  );
  const mdfeId = await assertTenantFk(
    "fiscal_mdfes",
    dto.mdfe_id,
    tenantId,
    "MDF-e",
    { optional: true },
  );
  validarCnpjCertificado(
    empresa.cnpj,
    dto.cpf_cnpj_contratado,
    dto.cpf_cnpj_contratante,
  );
  verificarPisoMinimoFrete(dto);
  const retencoes = calcularRetencoes(dto, {
    inssAliquota: config.fiscal.retencaoInssAliquota,
    sestSenatAliquota: config.fiscal.retencaoSestSenatAliquota,
  });
  return {
    dto,
    empresa,
    certificado,
    caminhaoId,
    motoristaId,
    mdfeId,
    retencoes,
  };
}

function montarPayloadDeclaracao(dto, idOperacaoTransporte, retencoes) {
  return {
    IdOperacaoTransporte: idOperacaoTransporte,
    TipoOperacao: dto.tipo_operacao,
    CpfCnpjContratado: dto.cpf_cnpj_contratado,
    RNTRCContratado: dto.rntrc_contratado,
    CpfCnpjContratante: dto.cpf_cnpj_contratante,
    RNTRCContratante: dto.rntrc_contratante ?? undefined,
    CpfCnpjDestinatario: dto.cpf_cnpj_destinatario ?? undefined,
    ValorFrete: dto.valor_frete,
    // Obrigatórios por lei (ANTT): piso mínimo de frete (Lei 13.703/2018) e
    // Vale-Pedágio obrigatório (Lei 10.209/2001). Informados sempre; 0 quando
    // não há pedágio no percurso.
    ValorPisoMinimoFrete: dto.valor_piso_minimo_frete,
    ValorValePedagio: dto.valor_vale_pedagio,
    DataDeclaracao: dto.data_declaracao,
    DataInicioViagem: dto.data_inicio_viagem,
    DataFimViagem: dto.data_fim_viagem,
    Veiculos: dto.veiculos.map((v) => ({
      Placa: v.placa,
      RNTRCVeiculo: v.rntrc_veiculo,
      NumeroEixos: v.numero_eixos,
    })),
    OrigemDestino: dto.origem_destino
      ? {
          CodigoMunicipioOrigem: dto.origem_destino.codigo_municipio_origem,
          CodigoMunicipioDestino: dto.origem_destino.codigo_municipio_destino,
        }
      : undefined,
    DadosCarga: dto.dados_carga
      ? {
          CodigoNaturezaCarga: dto.dados_carga.codigo_natureza_carga,
          PesoCarga: dto.dados_carga.peso_carga,
          CodigoTipoCarga: dto.dados_carga.codigo_tipo_carga,
          NCM: dto.dados_carga.ncm ?? undefined,
        }
      : undefined,
    InfPagamento: dto.inf_pagamento.map((p) => ({
      TipoPagamento: p.tipo_pagamento,
      Valor: p.valor,
    })),
    InfIndicadoresOperacionais: dto.inf_indicadores_operacionais
      ? {
          PossuiRastreamento:
            dto.inf_indicadores_operacionais.possui_rastreamento,
          PossuiSeguroCarga:
            dto.inf_indicadores_operacionais.possui_seguro_carga,
        }
      : undefined,
    // Retenções do comprovante (3.3) — só entra quando há alíquota configurada.
    Retencoes: retencoes ? montarRetencoesPayload(retencoes) : undefined,
  };
}

export class CiotService {
  static async list(tenantId, { status } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (status) where.status = String(status);
    const rows = await prisma.fiscal_ciots.findMany({
      where,
      orderBy: { criado_em: "desc" },
    });
    return serializePrisma(rows);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404("fiscal_ciots", id, tenantId, "CIOT");
    return serializePrisma(row);
  }

  static async simular(tenantId, body) {
    const prep = await prepararDeclaracao(tenantId, body, {
      exigirCertificado: false,
    });
    const payload = montarPayloadDeclaracao(
      prep.dto,
      "CIOT-SIMULACAO",
      prep.retencoes,
    );
    logger.info("CIOT simulado — não transmitido à ANTT", { tenantId });
    return resultadoSimulacaoDocumento({
      tipo: "ciot",
      documento: {
        status: "simulacao",
        valor_frete: prep.dto.valor_frete,
        categoria_operacao: resolverCategoriaOperacao(prep.dto),
      },
      payload,
      empresa: prep.empresa,
    });
  }

  static async declarar(tenantId, body) {
    const {
      dto,
      empresa,
      certificado,
      caminhaoId,
      motoristaId,
      mdfeId,
      retencoes,
    } = await prepararDeclaracao(tenantId, body);

    const idOperacaoTransporte = await gerarIdOperacaoUnico(async (candidato) => {
      const existente = await prisma.fiscal_ciots.findUnique({
        where: { id_operacao_transporte: candidato },
        select: { id: true },
      });
      return Boolean(existente);
    });

    const resposta = await CiotProviderClient.declararOperacaoTransporte(
      montarPayloadDeclaracao(dto, idOperacaoTransporte, retencoes),
      certificado,
    );

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      throw badRequest("Provedor de CIOT rejeitou a declaração da operação de transporte", {
        codigo: resposta?.Codigo,
        mensagem: resposta?.Mensagem,
      });
    }

    const ciot = await prisma.fiscal_ciots.create({
      data: {
        tenant_id: Number(tenantId),
        fiscal_empresa_id: empresa.id,
        caminhao_id: caminhaoId,
        motorista_id: motoristaId,
        mdfe_id: mdfeId,
        carga_ncm: dto.dados_carga?.ncm ?? null,
        categoria_operacao: resolverCategoriaOperacao(dto),
        ...retencoes,
        id_operacao_transporte: idOperacaoTransporte,
        codigo_identificacao_operacao:
          resposta.CodigoIdentificacaoOperacao ?? null,
        codigo_verificador: resposta.CodigoVerificador ?? null,
        protocolo: resposta.Protocolo ?? null,
        status: "declarado",
        valor_frete: dto.valor_frete,
        data_declaracao: new Date(dto.data_declaracao),
        data_inicio_viagem: new Date(dto.data_inicio_viagem),
        data_fim_viagem: new Date(dto.data_fim_viagem),
        veiculos: dto.veiculos,
        inf_pagamento: dto.inf_pagamento,
        ...colunasRntrcSnapshot(dto),
      },
    });

    logger.info("CIOT declarado", {
      tenantId,
      id_operacao: ciot.id_operacao_transporte,
      ciot: ciot.codigo_identificacao_operacao,
    });
    return serializePrisma(ciot);
  }

  static async cancelar(tenantId, id, justificativa) {
    const ciot = await findOwnedOr404("fiscal_ciots", id, tenantId, "CIOT");
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      ciot.fiscal_empresa_id,
    );

    const janelaHoras = janelaCancelamentoHoras(ciot.categoria_operacao);
    const prazoLimite = new Date(ciot.data_inicio_viagem);
    prazoLimite.setHours(prazoLimite.getHours() + janelaHoras);
    if (new Date() > prazoLimite) {
      throw badRequest(
        `Cancelamento não permitido: prazo de ${janelaHoras}h após o início da viagem já expirou`,
      );
    }
    if (!ciot.codigo_identificacao_operacao) {
      throw badRequest(
        "Este CIOT ainda não possui código de identificação da operação retornado pelo provedor de CIOT",
      );
    }

    const resposta = await CiotProviderClient.cancelarOperacaoTransporte(
      {
        IdOperacaoTransporte: ciot.id_operacao_transporte,
        CodigoIdentificacaoOperacao: ciot.codigo_identificacao_operacao,
        Justificativa: justificativa,
      },
      certificado,
    );

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      throw badRequest("Provedor de CIOT rejeitou o cancelamento da operação de transporte", {
        codigo: resposta?.Codigo,
        mensagem: resposta?.Mensagem,
      });
    }

    const updated = await prisma.fiscal_ciots.update({
      where: { id: ciot.id },
      data: { status: "cancelado" },
    });
    return serializePrisma(updated);
  }

  static async encerrar(tenantId, id) {
    const ciot = await findOwnedOr404("fiscal_ciots", id, tenantId, "CIOT");
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      ciot.fiscal_empresa_id,
    );
    if (!ciot.codigo_identificacao_operacao) {
      throw badRequest(
        "Este CIOT ainda não possui código de identificação da operação retornado pelo provedor de CIOT",
      );
    }

    const resposta = await CiotProviderClient.encerrarOperacaoTransporte(
      {
        IdOperacaoTransporte: ciot.id_operacao_transporte,
        CodigoIdentificacaoOperacao: ciot.codigo_identificacao_operacao,
      },
      certificado,
    );

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      throw badRequest("Provedor de CIOT rejeitou o encerramento da operação de transporte", {
        codigo: resposta?.Codigo,
        mensagem: resposta?.Mensagem,
      });
    }

    const updated = await prisma.fiscal_ciots.update({
      where: { id: ciot.id },
      data: { status: "encerrado" },
    });
    return serializePrisma(updated);
  }

  static async consultarSituacaoTransportador(tenantId, body) {
    const dto = consultarSituacaoTransportadorSchema.parse(body);
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      dto.fiscal_empresa_id,
    );
    return CiotProviderClient.consultarSituacaoTransportador(
      { CpfCnpj: dto.cpf_cnpj, RNTRC: dto.rntrc },
      certificado,
    );
  }

  static async consultarCiotGerado(tenantId, id) {
    const ciot = await findOwnedOr404("fiscal_ciots", id, tenantId, "CIOT");
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      ciot.fiscal_empresa_id,
    );
    return CiotProviderClient.consultarCiotGerado(
      { IdOperacaoTransporte: ciot.id_operacao_transporte },
      certificado,
    );
  }
}
