import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
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

// Código de sucesso documentado pela ANTT para a declaração. Os demais
// endpoints não têm código de sucesso confirmado — assume-se o mesmo 110 até
// validar em teste real (mesma ressalva do jwsoft).
const CODIGO_SUCESSO_OPERACAO = 110;
// Regra B34: cancelamento só até 24h após o início da viagem declarada.
const JANELA_CANCELAMENTO_HORAS = 24;

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

function montarPayloadDeclaracao(dto, idOperacaoTransporte) {
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

  static async declarar(tenantId, body) {
    const dto = declararCiotSchema.parse(body);

    const { empresa, certificado } = await resolveEmpresaCertificado(
      tenantId,
      dto.fiscal_empresa_id,
    );
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

    validarCnpjCertificado(
      empresa.cnpj,
      dto.cpf_cnpj_contratado,
      dto.cpf_cnpj_contratante,
    );

    const idOperacaoTransporte = await gerarIdOperacaoUnico(async (candidato) => {
      const existente = await prisma.fiscal_ciots.findUnique({
        where: { id_operacao_transporte: candidato },
        select: { id: true },
      });
      return Boolean(existente);
    });

    const resposta = await CiotProviderClient.declararOperacaoTransporte(
      montarPayloadDeclaracao(dto, idOperacaoTransporte),
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

    const prazoLimite = new Date(ciot.data_inicio_viagem);
    prazoLimite.setHours(prazoLimite.getHours() + JANELA_CANCELAMENTO_HORAS);
    if (new Date() > prazoLimite) {
      throw badRequest(
        `Cancelamento não permitido: prazo de ${JANELA_CANCELAMENTO_HORAS}h após o início da viagem já expirou`,
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
