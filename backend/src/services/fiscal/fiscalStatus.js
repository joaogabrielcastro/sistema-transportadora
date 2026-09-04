/**
 * Estados locais do CT-e / MDF-e (adaptados ao vocabulário já usado no ATrack).
 *
 * DRAFT       -> rascunho
 * PROCESSING  -> processando
 * AUTHORIZED  -> processado
 * REJECTED    -> rejeitado
 * CANCELLED   -> cancelado
 * CLOSED      -> encerrado   (só MDF-e)
 * ERROR       -> erro
 *
 * `pendente` permanece como valor legado (default antigo da tabela).
 */

export const CTE_STATUS = Object.freeze({
  RASCUNHO: "rascunho",
  PROCESSANDO: "processando",
  PROCESSADO: "processado",
  REJEITADO: "rejeitado",
  CANCELADO: "cancelado",
  ERRO: "erro",
  PENDENTE: "pendente",
});

export const MDFE_STATUS = Object.freeze({
  ...CTE_STATUS,
  ENCERRADO: "encerrado",
});

export const STATUS_RASCUNHO_EDITAVEL = Object.freeze([
  CTE_STATUS.RASCUNHO,
  CTE_STATUS.REJEITADO,
  CTE_STATUS.ERRO,
  CTE_STATUS.PENDENTE,
]);

const LOCK_MS = 2 * 60 * 1000;

export function httpError(statusCode, message, extra) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (extra) err.details = extra;
  return err;
}

/** True se o documento já foi aceito/enviado à Brasil NFe (não reemitir). */
export function documentoJaEnviadoAoProvedor(row) {
  const chave = row?.chave_acesso != null && String(row.chave_acesso).trim();
  const interno = row?.brasil_nfe_id != null && String(row.brasil_nfe_id).trim();
  return Boolean(chave || interno);
}

/**
 * Decide se a linha pode ser enviada à Brasil NFe.
 * `processando` só é retomável depois do timeout (crash a meio da emissão),
 * e somente se ainda não houver chave/identificador interno.
 */
export function avaliarClaimEmissao(row, { now = Date.now() } = {}) {
  const status = String(row?.status || "");
  if (status === CTE_STATUS.PROCESSADO) {
    return { action: "already_authorized" };
  }
  if (status === CTE_STATUS.CANCELADO) {
    return {
      action: "reject",
      error: httpError(400, "Documento já cancelado — não é possível emitir de novo."),
    };
  }
  if (status === MDFE_STATUS.ENCERRADO) {
    return {
      action: "reject",
      error: httpError(400, "MDF-e já encerrado — não é possível emitir de novo."),
    };
  }
  if (status === CTE_STATUS.PROCESSANDO) {
    // Já aceito pela Brasil NFe (lote / chave / identificador): consultar, não reenviar.
    if (documentoJaEnviadoAoProvedor(row)) {
      return { action: "consult" };
    }
    const started = row?.emissao_iniciada_em
      ? new Date(row.emissao_iniciada_em).getTime()
      : 0;
    if (started && now - started < LOCK_MS) {
      return {
        action: "reject",
        error: httpError(
          409,
          "Emissão já em andamento. Aguarde o retorno da SEFAZ ou consulte o status.",
        ),
      };
    }
    return { action: "claim" };
  }
  if (STATUS_RASCUNHO_EDITAVEL.includes(status) || !status) {
    return { action: "claim" };
  }
  return {
    action: "reject",
    error: httpError(
      400,
      `Não é possível emitir um documento com status "${status}".`,
    ),
  };
}

export function mensagemSefaz(resposta) {
  if (!resposta || typeof resposta !== "object") return null;
  if (typeof resposta.DsMotivo === "string" && resposta.DsMotivo.trim()) {
    return resposta.DsMotivo;
  }
  if (typeof resposta.Error === "string" && resposta.Error.trim()) {
    return resposta.Error;
  }
  if (typeof resposta.error === "string" && resposta.error.trim()) {
    return resposta.error;
  }
  const erros = resposta.erros ?? resposta.Erros;
  if (Array.isArray(erros) && erros.length > 0) {
    return erros.map(String).join("; ");
  }
  return null;
}

export function codigoSefaz(resposta) {
  const bruto =
    resposta?.CodStatusRespostaSefaz ??
    resposta?.codRespostaSefaz ??
    resposta?.codStatusRespostaSefaz ??
    null;
  if (bruto == null || bruto === "") return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

/** Remove blobs e segredos antes de persistir o retorno da Brasil NFe. */
export function sanitizarRespostaProvedor(resposta) {
  if (!resposta || typeof resposta !== "object") return resposta ?? null;
  const {
    base64Xml: _x,
    base64DACTe: _d,
    base64DAMDFe: _m,
    Base64Xml: _X,
    Base64File: _f,
    Base64CertificateFile: _c,
    Senha: _s,
    Token: _t,
    UserToken: _u,
    raw: _r,
    ...rest
  } = resposta;
  return rest;
}

export function colunasSefaz(resposta, operacao) {
  return {
    sefaz_codigo: codigoSefaz(resposta),
    sefaz_mensagem: mensagemSefaz(resposta),
    sefaz_detalhes: sanitizarRespostaProvedor(resposta),
    sefaz_operacao: operacao,
    sefaz_em: new Date(),
  };
}

/**
 * Interpreta a resposta de EnviarConhecimentoTransporte.
 * Docs: status 0 + chave = autorizado; erros[] / ausência de chave = rejeição.
 * O contrato legado (jwsoft) usava status === 2 para rejeição — ainda aceito.
 */
export function interpretarRespostaCte(resposta) {
  const chave = resposta?.chave ? String(resposta.chave) : null;
  const status = resposta?.status;
  const erros = Array.isArray(resposta?.erros) ? resposta.erros : [];
  const msg = mensagemSefaz(resposta);

  if (chave && (status === 0 || status === 1 || status == null)) {
    return { outcome: "authorized", chave, erros, mensagem: msg };
  }
  if (status === 2 || (erros.length > 0 && !chave)) {
    return {
      outcome: "rejected",
      chave,
      erros,
      mensagem: msg || "A SEFAZ rejeitou a emissão do CT-e.",
    };
  }
  if (!chave) {
    return {
      outcome: "error",
      chave: null,
      erros,
      mensagem: msg || "A Brasil NFe não retornou a chave de acesso do CT-e.",
    };
  }
  return { outcome: "authorized", chave, erros, mensagem: msg };
}

/**
 * Interpreta EnviarManifestoTransporte.
 * Docs: status 1 = lote processado, 2 = aguardando, 3 = erro.
 */
export function interpretarRespostaMdfe(resposta) {
  const chave = resposta?.chave ? String(resposta.chave) : null;
  const status = resposta?.status;
  const msg = mensagemSefaz(resposta);

  if (status === 2) {
    return {
      outcome: "processing",
      chave,
      mensagem: msg || "MDF-e aguardando processamento na SEFAZ.",
    };
  }
  if (status === 3 || (msg && !chave)) {
    return {
      outcome: "rejected",
      chave,
      mensagem: msg || "A SEFAZ rejeitou a emissão do MDF-e.",
    };
  }
  if (chave && (status === 1 || status === 0 || status == null)) {
    return { outcome: "authorized", chave, mensagem: msg };
  }
  return {
    outcome: "error",
    chave,
    mensagem: msg || "A Brasil NFe não retornou a chave de acesso do MDF-e.",
  };
}

/** Eventos (cancelamento / encerramento): Status 1 ok, 2 aguardando, 3 erro. */
export function interpretarRespostaEvento(resposta) {
  const status = resposta?.Status ?? resposta?.status;
  const msg = mensagemSefaz(resposta);
  if (status === 3) {
    return { outcome: "error", mensagem: msg || "A SEFAZ rejeitou o evento." };
  }
  if (status === 2) {
    return { outcome: "processing", mensagem: msg };
  }
  return { outcome: "authorized", mensagem: msg };
}

export function prazoCancelamentoExpirado(autorizadoEm, { now = Date.now() } = {}) {
  if (!autorizadoEm) return false;
  const t = new Date(autorizadoEm).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > 24 * 60 * 60 * 1000;
}

export function identificadorInternoCte(id) {
  return `cte-${id}`;
}

export function identificadorInternoMdfe(id) {
  return `mdfe-${id}`;
}

export function extrairBase64Arquivo(resposta) {
  if (resposta == null) return null;
  if (typeof resposta === "string") {
    const s = resposta.trim();
    return s && s !== "{}" ? s : null;
  }
  if (typeof resposta !== "object") return null;
  return (
    resposta.base64Xml ||
    resposta.Base64Xml ||
    resposta.base64DACTe ||
    resposta.base64DAMDFe ||
    resposta.Base64File ||
    resposta.raw ||
    null
  );
}

/** Consulta remota só faz sentido depois de alguma tentativa de envio. */
export function deveConsultarProvedor(row) {
  if (!row) return false;
  if (documentoJaEnviadoAoProvedor(row)) return true;
  return String(row.status || "") === CTE_STATUS.PROCESSANDO;
}

/**
 * Corpo oficial de POST /fiscal/ObterNotasFiscais.
 * TipoDocumentoFiscal 1 = saídas (CT-e/MDF-e emitidos pela empresa).
 */
export function montarPayloadObterNotasFiscais({
  identificadorInterno,
  ambiente,
  dataRef,
  agora = new Date(),
} = {}) {
  const ref = dataRef ? new Date(dataRef) : agora;
  const inicioMs = Number.isNaN(ref.getTime())
    ? agora.getTime()
    : ref.getTime();
  const inicio = new Date(inicioMs - 24 * 60 * 60 * 1000);
  const fim = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return {
    TipoDocumentoFiscal: 1,
    TipoAmbiente: ambiente,
    IdentificadorInterno: identificadorInterno,
    DtInicio: inicio.toISOString(),
    DtFim: fim.toISOString(),
  };
}

export function listarNotasConsulta(resposta) {
  if (!resposta || typeof resposta !== "object") return [];
  const notas = resposta.Notas ?? resposta.notas;
  return Array.isArray(notas) ? notas : [];
}

export function extrairChaveNota(nota) {
  if (!nota || typeof nota !== "object") return null;
  const bruto =
    nota.chave ??
    nota.Chave ??
    nota.ChaveNF ??
    nota.chaveNF ??
    nota.ReturnNF?.ChaveNF ??
    nota.returnNf?.chaveNf ??
    null;
  return bruto != null && String(bruto).trim() ? String(bruto).trim() : null;
}

export function escolherNotaConsultada(
  notas,
  { identificadorInterno, chave } = {},
) {
  if (!Array.isArray(notas) || notas.length === 0) return null;
  if (chave) {
    const match = notas.find((n) => extrairChaveNota(n) === String(chave));
    if (match) return match;
  }
  if (identificadorInterno) {
    const match = notas.find((n) => {
      const id = n.IdentificadorInterno ?? n.identificadorInterno;
      return id != null && String(id) === String(identificadorInterno);
    });
    if (match) return match;
  }
  return notas[0];
}

function textoSituacaoNota(nota) {
  const bruto =
    nota?.Situacao ??
    nota?.situacao ??
    nota?.DsSituacao ??
    nota?.dsSituacao ??
    "";
  return String(bruto).toLowerCase();
}

/**
 * Interpreta um item de ObterNotasFiscais. Situação documentada: autorizado,
 * cancelado, denegado. Também aceita os status numéricos já usados na emissão.
 */
export function interpretarNotaConsultada(nota) {
  if (!nota || typeof nota !== "object") {
    return {
      outcome: "not_found",
      chave: null,
      mensagem: "Documento ainda não encontrado na Brasil NFe.",
    };
  }
  const chave = extrairChaveNota(nota);
  const situacao = textoSituacaoNota(nota);
  const status = nota.Status ?? nota.status;
  const msg = mensagemSefaz(nota);

  if (situacao.includes("cancel")) {
    return {
      outcome: "cancelled",
      chave,
      mensagem: msg || "Documento cancelado na SEFAZ.",
    };
  }
  if (
    situacao.includes("deneg") ||
    situacao.includes("rejei") ||
    situacao.includes("reject")
  ) {
    return {
      outcome: "rejected",
      chave,
      mensagem: msg || "A SEFAZ rejeitou o documento.",
    };
  }
  if (status === 2 || situacao.includes("aguard") || situacao.includes("processando")) {
    return {
      outcome: "processing",
      chave,
      mensagem: msg || "Aguardando processamento na SEFAZ.",
    };
  }
  if (status === 3) {
    return {
      outcome: "rejected",
      chave,
      mensagem: msg || "A SEFAZ rejeitou o documento.",
    };
  }
  if (
    situacao.includes("autoriz") ||
    chave ||
    status === 0 ||
    status === 1 ||
    status === 100 ||
    status === 150
  ) {
    return {
      outcome: "authorized",
      chave,
      mensagem: msg || "Documento autorizado na SEFAZ.",
    };
  }
  return {
    outcome: "processing",
    chave,
    mensagem: msg || "Aguardando processamento na SEFAZ.",
  };
}

/**
 * Colunas a persistir após ObterNotasFiscais. Não reverte encerrado/cancelado
 * local para autorizado.
 */
export function dadosPersistenciaConsulta(
  interpretacao,
  nota,
  { row, identificadorInterno } = {},
) {
  const local = String(row?.status || "");
  const sefaz = colunasSefaz(nota && typeof nota === "object" ? nota : {}, "consulta");
  const interno =
    identificadorInterno ??
    (row?.brasil_nfe_id != null ? String(row.brasil_nfe_id) : undefined);

  if (local === MDFE_STATUS.ENCERRADO) {
    return { ...sefaz };
  }
  if (local === CTE_STATUS.CANCELADO && interpretacao.outcome !== "cancelled") {
    return { ...sefaz };
  }
  if (interpretacao.outcome === "not_found") {
    return null;
  }

  const numero =
    nota?.numero ?? nota?.Numero ?? nota?.NumeroNF ?? row?.numero ?? null;
  const serie = nota?.serie ?? nota?.Serie ?? row?.serie ?? null;
  const protocolo = nota
    ? (nota.protocolo ??
        nota.Protocolo ??
        nota.numeroProtocolo ??
        nota.NumeroProtocolo ??
        nota.NuProtocolo ??
        nota.nProt ??
        row?.numero_protocolo)
    : row?.numero_protocolo;

  const base = {
    ...sefaz,
    ...(interno ? { brasil_nfe_id: interno } : {}),
    ...(interpretacao.chave ? { chave_acesso: interpretacao.chave } : {}),
    ...(numero != null ? { numero: String(numero) } : {}),
    ...(serie != null ? { serie: String(serie) } : {}),
    ...(protocolo != null ? { numero_protocolo: String(protocolo) } : {}),
  };

  if (interpretacao.outcome === "authorized") {
    return {
      ...base,
      status: CTE_STATUS.PROCESSADO,
      autorizado_em: row?.autorizado_em ?? new Date(),
      data_emissao: row?.data_emissao ?? new Date(),
    };
  }
  if (interpretacao.outcome === "cancelled") {
    return {
      ...base,
      status: CTE_STATUS.CANCELADO,
      cancelado_em: row?.cancelado_em ?? new Date(),
    };
  }
  if (interpretacao.outcome === "rejected") {
    return {
      ...base,
      status: CTE_STATUS.REJEITADO,
    };
  }
  if (interpretacao.outcome === "processing") {
    return {
      ...base,
      status: CTE_STATUS.PROCESSANDO,
    };
  }
  return null;
}
