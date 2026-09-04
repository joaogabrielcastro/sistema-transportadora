import { somenteDigitos } from "./fiscalForms.js";

export const TIPO_OPERACAO_CIOT = [
  { value: "1", label: "1 — Lotação" },
  { value: "2", label: "2 — Fracionada" },
  { value: "3", label: "3 — TAC-Agregado" },
];

export const TIPO_PAGAMENTO_CIOT = [
  { value: "0", label: "0 — Pagamento antecipado" },
  { value: "1", label: "1 — Pagamento à vista" },
  { value: "2", label: "2 — Pagamento a prazo" },
];

export const CATEGORIA_CIOT = {
  1: "lotacao",
  2: "fracionada",
  3: "tac_agregado",
};

export function tipoOperacaoCiot(value) {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** Lotação e fracionada exigem destinatário, origem/destino e carga. */
export function exigeDestinatarioCargaCiot(tipo) {
  const n = tipoOperacaoCiot(tipo);
  return n === 1 || n === 2;
}

/** Lotação exige indicadores (rastreamento / seguro). */
export function exigeIndicadoresCiot(tipo) {
  return tipoOperacaoCiot(tipo) === 1;
}

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoOuNulo(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

/**
 * Monta o corpo de POST /fiscal/ciot/declarar a partir do estado da tela.
 * Campos condicionais (destinatário, carga, indicadores) só entram quando
 * o tipo de operação exige — TAC-Agregado não manda destinatário.
 */
export function montarPayloadCiot({
  form = {},
  veiculos = [],
  pagamentos = [],
} = {}) {
  const tipo = tipoOperacaoCiot(form.tipo_operacao);
  const veiculosOk = veiculos
    .map((v) => ({
      placa: String(v.placa || "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase(),
      rntrc_veiculo: somenteDigitos(v.rntrc_veiculo).slice(0, 9),
      numero_eixos: num(v.numero_eixos),
    }))
    .filter((v) => v.placa && v.rntrc_veiculo && v.numero_eixos > 0);

  const pagamentosOk = pagamentos
    .map((p) => ({
      tipo_pagamento: num(p.tipo_pagamento),
      valor: num(p.valor),
    }))
    .filter(
      (p) =>
        p.tipo_pagamento != null && p.valor != null && p.valor > 0,
    );

  const payload = {
    fiscal_empresa_id: num(form.fiscal_empresa_id),
    tipo_operacao: tipo,
    cpf_cnpj_contratado: somenteDigitos(form.cpf_cnpj_contratado).slice(0, 14),
    rntrc_contratado: somenteDigitos(form.rntrc_contratado).slice(0, 9),
    cpf_cnpj_contratante: somenteDigitos(form.cpf_cnpj_contratante).slice(0, 14),
    valor_frete: num(form.valor_frete),
    valor_piso_minimo_frete: num(form.valor_piso_minimo_frete),
    valor_vale_pedagio: num(form.valor_vale_pedagio) ?? 0,
    data_declaracao: isoOuNulo(form.data_declaracao),
    data_inicio_viagem: isoOuNulo(form.data_inicio_viagem),
    data_fim_viagem: isoOuNulo(form.data_fim_viagem),
    veiculos: veiculosOk,
    inf_pagamento: pagamentosOk,
  };

  const caminhaoId = num(form.caminhao_id);
  if (caminhaoId) payload.caminhao_id = caminhaoId;
  const motoristaId = num(form.motorista_id);
  if (motoristaId) payload.motorista_id = motoristaId;
  const mdfeId = num(form.mdfe_id);
  if (mdfeId) payload.mdfe_id = mdfeId;

  const rntrcContratante = somenteDigitos(form.rntrc_contratante).slice(0, 9);
  if (rntrcContratante) payload.rntrc_contratante = rntrcContratante;

  if (exigeDestinatarioCargaCiot(tipo)) {
    payload.cpf_cnpj_destinatario = somenteDigitos(
      form.cpf_cnpj_destinatario,
    ).slice(0, 14);
    payload.origem_destino = {
      codigo_municipio_origem: somenteDigitos(
        form.codigo_municipio_origem,
      ).slice(0, 7),
      codigo_municipio_destino: somenteDigitos(
        form.codigo_municipio_destino,
      ).slice(0, 7),
    };
    payload.dados_carga = {
      codigo_natureza_carga: String(form.codigo_natureza_carga || "").trim(),
      peso_carga: num(form.peso_carga),
      codigo_tipo_carga: num(form.codigo_tipo_carga),
    };
    const ncm = somenteDigitos(form.carga_ncm).slice(0, 8);
    if (ncm) payload.dados_carga.ncm = ncm;
  }

  if (exigeIndicadoresCiot(tipo)) {
    payload.inf_indicadores_operacionais = {
      possui_rastreamento: Boolean(form.possui_rastreamento),
      possui_seguro_carga: Boolean(form.possui_seguro_carga),
    };
  }

  return payload;
}

/**
 * Checagens de tela (espelham o Zod). Devolve mensagens; array vazio = pode enviar.
 */
export function errosDeclaracaoCiot(payload) {
  const erros = [];
  if (!payload?.fiscal_empresa_id) {
    erros.push("Selecione a empresa fiscal (CNPJ do certificado).");
  }
  if (!payload?.tipo_operacao) {
    erros.push("Informe o tipo da operação (lotação, fracionada ou TAC-Agregado).");
  }
  if (!payload?.cpf_cnpj_contratado || payload.cpf_cnpj_contratado.length < 11) {
    erros.push("Informe o CPF/CNPJ do contratado.");
  }
  if (!payload?.rntrc_contratado) {
    erros.push("Informe o RNTRC do contratado.");
  }
  if (!payload?.cpf_cnpj_contratante || payload.cpf_cnpj_contratante.length < 11) {
    erros.push("Informe o CPF/CNPJ do contratante.");
  }
  if (!(payload?.valor_frete > 0)) {
    erros.push("Informe o valor do frete.");
  }
  if (!(payload?.valor_piso_minimo_frete > 0)) {
    erros.push("Informe o piso mínimo ANTT (a consulta automática ainda não está disponível).");
  }
  if (
    payload?.valor_frete > 0 &&
    payload?.valor_piso_minimo_frete > 0 &&
    payload.valor_frete < payload.valor_piso_minimo_frete
  ) {
    erros.push("O valor do frete está abaixo do piso mínimo informado.");
  }
  if (payload?.valor_vale_pedagio == null || payload.valor_vale_pedagio < 0) {
    erros.push("Informe o vale-pedágio (0 se não houver no percurso).");
  }
  if (!payload?.data_declaracao) erros.push("Informe a data da declaração.");
  if (!payload?.data_inicio_viagem) erros.push("Informe o início da viagem.");
  if (!payload?.data_fim_viagem) erros.push("Informe o fim da viagem.");
  if (!Array.isArray(payload?.veiculos) || payload.veiculos.length < 2) {
    erros.push("Informe ao menos 2 veículos (máximo 5).");
  } else if (payload.veiculos.length > 5) {
    erros.push("No máximo 5 veículos na declaração.");
  }
  if (!Array.isArray(payload?.inf_pagamento) || payload.inf_pagamento.length < 1) {
    erros.push("Informe ao menos uma forma de pagamento.");
  }
  if (exigeDestinatarioCargaCiot(payload?.tipo_operacao)) {
    if (!payload.cpf_cnpj_destinatario) {
      erros.push("Destinatário é obrigatório para lotação e fracionada.");
    }
    if (
      !payload.origem_destino?.codigo_municipio_origem ||
      !payload.origem_destino?.codigo_municipio_destino
    ) {
      erros.push("Informe os códigos IBGE de origem e destino.");
    }
    if (
      !payload.dados_carga?.codigo_natureza_carga ||
      !(payload.dados_carga?.peso_carga > 0) ||
      payload.dados_carga?.codigo_tipo_carga == null
    ) {
      erros.push("Informe natureza, peso e tipo da carga.");
    }
  }
  if (
    exigeIndicadoresCiot(payload?.tipo_operacao) &&
    !payload.inf_indicadores_operacionais
  ) {
    erros.push("Informe os indicadores operacionais (rastreamento / seguro).");
  }
  return erros;
}
