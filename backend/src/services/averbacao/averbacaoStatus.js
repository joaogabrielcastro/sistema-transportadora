/**
 * Estados internos de averbação e mapeamento do retorno AT&M
 * (Manual Integração Web Service 2.0 REST v1.1, seções 10, 12, 22, 26, 28).
 *
 * A AT&M não publica um enum de status REST além de:
 *  - CT-e/NF-e: presença de `Averbado` (averbado) ou `Erros` (recusa)
 *  - MDF-e: presença de `Declarado` (declarado) ou `Erros`
 *  - cancelamento: sucesso quando não há `Erros` e o CT-e já estava averbado
 *
 * Códigos reenviáveis automaticamente (manual §10 e §28):
 *  000, 907, 910, brancos, congestionamento, timeout.
 * Recusas de consistência NÃO devem ser reenviadas sem correção.
 */

export const AVERBACAO_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  AVERBED: "averbed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  ERROR: "error",
});

export const AVERBACAO_AMBIENTE = Object.freeze({
  HOMOLOGACAO: "homologacao",
  PRODUCAO: "producao",
});

export const AVERBACAO_PROVIDER = Object.freeze({
  ATM: "atm",
});

export const AVERBACAO_TIPO = Object.freeze({
  CTE: "cte",
  MDFE: "mdfe",
});

export const AVERBACAO_OPERACAO = Object.freeze({
  AVERBAR: "averbar",
  DECLARAR: "declarar",
  CANCELAR: "cancelar",
});

/** Códigos AT&M que o manual manda reenviar automaticamente. */
export const ATM_RETRYABLE_CODES = Object.freeze(["000", "907", "910"]);

const STALE_PROCESSING_MS = 5 * 60 * 1000;

function firstItem(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizeAtmErrorCode(code) {
  if (code == null || code === "") return "";
  return String(code).trim();
}

export function isRetryableAtmCode(code) {
  const c = normalizeAtmErrorCode(code);
  if (!c) return true;
  return ATM_RETRYABLE_CODES.includes(c);
}

/**
 * Timeout, 5xx, rede e os códigos 000/907/910 do manual.
 * Autenticação (904/401/915) e recusa de negócio (400) não entram aqui
 * — 915 é tratado no provider com re-auth, não como retry de fila cego.
 */
export function isRetryableAverbacaoFailure({
  errorCode,
  httpStatus,
  timeout = false,
  network = false,
} = {}) {
  if (timeout || network) return true;
  if (httpStatus != null && Number(httpStatus) >= 500) return true;
  if (httpStatus === 429) return true;
  return isRetryableAtmCode(errorCode);
}

export function isAuthFailure({ errorCode, httpStatus } = {}) {
  const c = normalizeAtmErrorCode(errorCode);
  if (httpStatus === 401 || httpStatus === 403) return true;
  return c === "904" || c === "905" || c === "914" || c === "915" || c === "919" || c === "920";
}

/**
 * "Documento já cadastrado" devolve protocolo/número (manual §12).
 * Trata como sucesso idempotente, não como rejeição.
 */
export function isAtmDocumentoJaCadastrado(response) {
  const erros = firstItem(response?.Erros?.Erro) ? [].concat(response.Erros.Erro) : [];
  const infos = firstItem(response?.Infos?.Info) ? [].concat(response.Infos.Info) : [];
  const textos = [...erros, ...infos].map((e) =>
    String(e?.Descricao || "").toLowerCase(),
  );
  if (textos.some((t) => t.includes("ja cadastrado") || t.includes("já cadastrado"))) {
    return true;
  }
  const averbado = firstItem(response?.Averbado);
  const declarado = firstItem(response?.Declarado);
  if ((averbado?.Protocolo || declarado?.Protocolo) && erros.length > 0) {
    const codes = erros.map((e) => normalizeAtmErrorCode(e?.Codigo));
    if (codes.some((c) => c && !isRetryableAtmCode(c) && c !== "000")) {
      return Boolean(averbado?.Protocolo || declarado?.Protocolo);
    }
  }
  return false;
}

export function extractAtmAverbado(response) {
  const averbado = firstItem(response?.Averbado);
  const declarado = firstItem(response?.Declarado);
  const bloco = averbado || declarado || null;
  const seguro = firstItem(bloco?.DadosSeguro);
  return {
    protocolo: bloco?.Protocolo ? String(bloco.Protocolo) : null,
    dh:
      bloco?.dhAverbacao || bloco?.dhChancela || bloco?.dhChance || null,
    numeroAverbacao: seguro?.NumeroAverbacao
      ? String(seguro.NumeroAverbacao)
      : null,
    cnpjSeguradora: seguro?.CNPJSeguradora
      ? String(seguro.CNPJSeguradora)
      : null,
    nomeSeguradora: seguro?.NomeSeguradora
      ? String(seguro.NomeSeguradora)
      : null,
    numApolice: seguro?.NumApolice ? String(seguro.NumApolice) : null,
    valorAverbado: seguro?.ValorAverbado ?? null,
    ramoAverbado: seguro?.RamoAverbado ?? null,
    declarado: Boolean(declarado) && !averbado,
  };
}

export function extractAtmErrors(response) {
  const raw = response?.Erros?.Erro;
  if (!raw) return [];
  return [].concat(raw).map((e) => ({
    codigo: normalizeAtmErrorCode(e?.Codigo),
    descricao: e?.Descricao != null ? String(e.Descricao) : "",
    valorEsperado: e?.ValorEsperado ?? null,
    valorInformado: e?.ValorInformado ?? null,
  }));
}

/**
 * Interpreta o JSON oficial de retorno AT&M (seção 12 / 22).
 * @returns {{ status: string, retryable: boolean, errorCode: string|null, errorMessage: string|null, extracted: object }}
 */
export function mapAtmResponse({ response, httpStatus, operacao, timeout, network } = {}) {
  if (timeout || network) {
    return {
      status: AVERBACAO_STATUS.ERROR,
      retryable: true,
      errorCode: timeout ? "timeout" : "network",
      errorMessage: timeout
        ? "Timeout ao contatar a averbadora."
        : "Falha de rede ao contatar a averbadora.",
      extracted: {},
    };
  }

  if (isAuthFailure({ httpStatus, errorCode: extractAtmErrors(response)[0]?.codigo })) {
    const err = extractAtmErrors(response)[0];
    return {
      status: AVERBACAO_STATUS.ERROR,
      retryable: false,
      errorCode: err?.codigo || String(httpStatus || "auth"),
      errorMessage: err?.descricao || "Falha de autenticação na averbadora.",
      extracted: {},
    };
  }

  const extracted = extractAtmAverbado(response);
  const erros = extractAtmErrors(response);
  const jaCadastrado = isAtmDocumentoJaCadastrado(response);

  if (operacao === AVERBACAO_OPERACAO.CANCELAR && !erros.length) {
    return {
      status: AVERBACAO_STATUS.CANCELLED,
      retryable: false,
      errorCode: null,
      errorMessage: null,
      extracted,
    };
  }

  if (extracted.protocolo && (!erros.length || jaCadastrado)) {
    return {
      status: AVERBACAO_STATUS.AVERBED,
      retryable: false,
      errorCode: jaCadastrado ? erros[0]?.codigo || null : null,
      errorMessage: jaCadastrado
        ? "Documento já cadastrado na averbadora — protocolo reutilizado."
        : null,
      extracted,
    };
  }

  if (erros.length) {
    const first = erros[0];
    const retryable = isRetryableAverbacaoFailure({
      errorCode: first.codigo,
      httpStatus,
    });
    return {
      status: retryable ? AVERBACAO_STATUS.ERROR : AVERBACAO_STATUS.REJECTED,
      retryable,
      errorCode: first.codigo || String(httpStatus || ""),
      errorMessage: erros.map((e) => e.descricao).filter(Boolean).join(" | "),
      extracted,
    };
  }

  if (httpStatus != null && httpStatus >= 500) {
    return {
      status: AVERBACAO_STATUS.ERROR,
      retryable: true,
      errorCode: String(httpStatus),
      errorMessage: "Averbadora indisponível.",
      extracted,
    };
  }

  return {
    status: AVERBACAO_STATUS.ERROR,
    retryable: true,
    errorCode: httpStatus != null ? String(httpStatus) : "unexpected",
    errorMessage: "Resposta inesperada da averbadora.",
    extracted,
  };
}

/**
 * Decide se uma linha existente pode ser enviada de novo.
 * Idempotência obrigatória: averbado/em voo não reenvia.
 */
export function decidirEnvioAverbacao(row, { now = Date.now(), force = false } = {}) {
  if (!row) return { action: "create" };

  const status = String(row.status || "");
  if (status === AVERBACAO_STATUS.AVERBED && !force) {
    return { action: "skip_already_averbed" };
  }
  if (status === AVERBACAO_STATUS.CANCELLED && !force) {
    return { action: "skip_cancelled" };
  }
  if (status === AVERBACAO_STATUS.PROCESSING) {
    const updated = row.atualizado_em ? new Date(row.atualizado_em).getTime() : 0;
    const stale = !updated || now - updated > STALE_PROCESSING_MS;
    if (!stale && !force) return { action: "skip_in_flight" };
    return { action: "send" };
  }
  if (status === AVERBACAO_STATUS.REJECTED && !force) {
    return { action: "skip_rejected" };
  }
  if (status === AVERBACAO_STATUS.ERROR || status === AVERBACAO_STATUS.PENDING) {
    return { action: "send" };
  }
  if (force && status === AVERBACAO_STATUS.REJECTED) {
    return { action: "send" };
  }
  return { action: "send" };
}

export function podeReprocessar(row) {
  const status = String(row?.status || "");
  return (
    status === AVERBACAO_STATUS.ERROR ||
    status === AVERBACAO_STATUS.PENDING ||
    status === AVERBACAO_STATUS.REJECTED
  );
}

export function podeCancelar(row) {
  return String(row?.status || "") === AVERBACAO_STATUS.AVERBED;
}

const SENSITIVE_KEY =
  /senha|password|token|bearer|authorization|secret|usuario|user(name)?/i;

export function sanitizeForLog(value, depth = 0) {
  if (value == null) return value;
  if (depth > 6) return "[…]";
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 80)}…[${value.length} chars]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeForLog(v, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = v ? "[redacted]" : v;
      } else {
        out[k] = sanitizeForLog(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function publicAverbacao(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    cte_id: row.cte_id,
    mdfe_id: row.mdfe_id,
    tipo_documento: row.tipo_documento,
    operacao: row.operacao,
    provider: row.provider,
    ambiente: row.ambiente,
    chave_acesso: row.chave_acesso,
    seguradora: row.seguradora,
    numero_apolice: row.numero_apolice,
    protocolo: row.protocolo,
    numero_averbacao: row.numero_averbacao,
    status: row.status,
    error_code: row.error_code,
    error_message: row.error_message,
    attempts: row.attempts,
    retryable: row.retryable,
    averbed_at: row.averbed_at,
    cancelled_at: row.cancelled_at,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}
