import { config } from "../../config/index.js";

// Código de sucesso documentado pela ANTT para a declaração. Os demais
// endpoints não têm código de sucesso confirmado — assume-se o mesmo 110 até
// validar em teste real (mesma ressalva do jwsoft).
export const CODIGO_SUCESSO_OPERACAO = 110;
// Regra B34: cancelamento só até 24h após o início da viagem declarada.
export const JANELA_CANCELAMENTO_HORAS = 24;

// Janela de cancelamento (horas) por categoria de operação (item 3.2). Hoje
// TODAS usam as mesmas 24h da regra B34 — o mapa é só o ponto único para
// ajustar prazo/retificação por categoria quando as regras forem confirmadas.
const JANELA_CANCELAMENTO_HORAS_POR_CATEGORIA = {
  lotacao: JANELA_CANCELAMENTO_HORAS,
  fracionada: JANELA_CANCELAMENTO_HORAS,
  tac_agregado: JANELA_CANCELAMENTO_HORAS,
};

/** Mapeia tipo_operacao (1/2/3) para a categoria explícita (item 3.2). */
export const CATEGORIA_POR_TIPO_OPERACAO = {
  1: "lotacao",
  2: "fracionada",
  3: "tac_agregado",
};

export function badRequestCiot(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

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
    throw badRequestCiot(
      "Piso mínimo de frete (ANTT) não informado. A consulta automática ao " +
        "piso ainda não está disponível — informe valor_piso_minimo_frete " +
        "calculado conforme a tabela ANTT vigente para a operação.",
    );
  }
  if (Number(dto.valor_frete) < Number(dto.valor_piso_minimo_frete)) {
    throw badRequestCiot(
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

export function montarPayloadDeclaracao(dto, idOperacaoTransporte, retencoes) {
  return {
    IdOperacaoTransporte: idOperacaoTransporte,
    TipoOperacao: dto.tipo_operacao,
    CpfCnpjContratado: dto.cpf_cnpj_contratado,
    RNTRCContratado: dto.rntrc_contratado,
    CpfCnpjContratante: dto.cpf_cnpj_contratante,
    RNTRCContratante: dto.rntrc_contratante ?? undefined,
    CpfCnpjDestinatario: dto.cpf_cnpj_destinatario ?? undefined,
    ValorFrete: dto.valor_frete,
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
    Retencoes: retencoes ? montarRetencoesPayload(retencoes) : undefined,
  };
}

export function retencoesDoContrato(contrato) {
  return {
    retencao_base: contrato.retencao_base,
    retencao_inss_aliquota: contrato.retencao_inss_aliquota,
    retencao_inss_valor: contrato.retencao_inss_valor,
    retencao_sest_senat_aliquota: contrato.retencao_sest_senat_aliquota,
    retencao_sest_senat_valor: contrato.retencao_sest_senat_valor,
  };
}

export { config as ciotDeclaracaoConfig };
