import { config } from "../../../config/index.js";
import { logger } from "../../../utils/logger.js";
import { AverbacaoProvider } from "../AverbacaoProvider.js";
import { AVERBACAO_AMBIENTE, sanitizeForLog } from "../averbacaoStatus.js";

/**
 * Cliente REST AT&M — Manual Integração Web Service 2.0 REST v1.1.
 *
 * Fontes:
 *  - http://svn.code.sf.net/p/acbr/code/tools/DFe/ANe/Manual%20AT&M%20-%20Integração%20WS2.0%20REST%20v1.1.pdf
 *  - Campo do token de Auth confirmado por implementação pública contra a API
 *    (objeto JSON com propriedade `Bearer`).
 *
 * URLs oficiais (§10 / §11 / §27.9):
 *  - produção:    webserver.averba.com.br/rest
 *  - homologação: homologaws.averba.com.br/rest
 *
 * TLS: o manual cita http://; o host oficial também responde em https://
 * (WSDL SOAP em https://webserver.averba.com.br/). Usamos HTTPS no mesmo
 * hostname/path — não é um endpoint inventado.
 *
 * Endpoints usados (todos POST):
 *  - /Auth   JSON { usuario, senha, codigoatm }
 *  - /Cte    body = XML protocolado (averbação ou cancelamento)
 *  - /MDFe   body = XML protocolado (declaração / cancelamento / encerramento)
 *
 * Consulta: a AT&M REST não documenta GET de consulta. Reenvio do XML é o
 * comportamento oficial de idempotência ("Documento já cadastrado" devolve
 * protocolo e número).
 */

export const ATM_PRODUCTION_BASE_URL = "https://webserver.averba.com.br/rest";
export const ATM_HOMOLOG_BASE_URL = "https://homologaws.averba.com.br/rest";

const PATHS = Object.freeze({
  auth: "/Auth",
  cte: "/Cte",
  mdfe: "/MDFe",
});

export function atmBaseUrl(ambiente) {
  if (ambiente === AVERBACAO_AMBIENTE.PRODUCAO) return ATM_PRODUCTION_BASE_URL;
  if (ambiente === AVERBACAO_AMBIENTE.HOMOLOGACAO) return ATM_HOMOLOG_BASE_URL;
  const err = new Error(`Ambiente de averbação inválido: ${ambiente}`);
  err.statusCode = 400;
  throw err;
}

function joinUrl(base, path) {
  return `${String(base).replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function timeoutMs() {
  return config.fiscal.httpTimeoutMs;
}

function assertAmbienteUrl(ambiente, url) {
  const expected = atmBaseUrl(ambiente);
  if (url !== expected) {
    throw new Error("Bloqueio de segurança: URL da averbadora não corresponde ao ambiente.");
  }
  if (
    ambiente === AVERBACAO_AMBIENTE.HOMOLOGACAO &&
    url.includes("webserver.averba.com.br")
  ) {
    throw new Error("Homologação AT&M não pode usar a URL de produção.");
  }
  if (
    ambiente === AVERBACAO_AMBIENTE.PRODUCAO &&
    url.includes("homologaws.averba.com.br")
  ) {
    throw new Error("Produção AT&M não pode usar a URL de homologação.");
  }
}

export function parseAtmAuthToken(body) {
  if (body == null) return null;
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return null;
    try {
      return parseAtmAuthToken(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  if (typeof body === "object") {
    const token = body.Bearer ?? body.bearer ?? body.token ?? body.Token;
    if (token == null) return null;
    return String(token).trim() || null;
  }
  return null;
}

function parseJsonSafe(text) {
  if (text == null || text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, init) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs());
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("Timeout ao contatar a AT&M.");
      e.timeout = true;
      throw e;
    }
    const e = new Error(err?.message || "Falha de rede ao contatar a AT&M.");
    e.network = true;
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export class AtmAverbacaoProvider extends AverbacaoProvider {
  constructor(credentials) {
    super(credentials);
    this.ambiente = credentials?.ambiente || AVERBACAO_AMBIENTE.HOMOLOGACAO;
    this.baseUrl = atmBaseUrl(this.ambiente);
    assertAmbienteUrl(this.ambiente, this.baseUrl);
    this.token = null;
  }

  documentoPath(tipoDocumento) {
    return tipoDocumento === "mdfe" ? PATHS.mdfe : PATHS.cte;
  }

  async autenticar() {
    const usuario = String(this.credentials?.usuario || "").trim();
    const senha = String(this.credentials?.senha || "");
    const codigoatm = String(this.credentials?.codigoAtm || "").trim();
    if (!usuario || !senha || !codigoatm) {
      const err = new Error(
        "Credenciais AT&M incompletas (usuário, senha e código AT&M).",
      );
      err.statusCode = 400;
      throw err;
    }

    const url = joinUrl(this.baseUrl, PATHS.auth);
    assertAmbienteUrl(this.ambiente, this.baseUrl);
    logger.info("AT&M Auth", {
      ambiente: this.ambiente,
      host: new URL(url).host,
    });

    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ usuario, senha, codigoatm }),
      });
    } catch (err) {
      return {
        ok: false,
        timeout: Boolean(err.timeout),
        network: Boolean(err.network),
        message: err.message,
        httpStatus: null,
      };
    }

    const raw = await res.text();
    const json = parseJsonSafe(raw);
    const token = parseAtmAuthToken(json ?? raw);
    if (!res.ok || !token) {
      logger.warn("AT&M Auth recusada", {
        ambiente: this.ambiente,
        httpStatus: res.status,
        body: sanitizeForLog(json || { raw: raw?.slice(0, 120) }),
      });
      return {
        ok: false,
        httpStatus: res.status,
        message: "A AT&M recusou a autenticação.",
        response: json,
      };
    }

    this.token = token;
    return { ok: true, httpStatus: res.status, message: "Credenciais válidas." };
  }

  async testarConexao() {
    return this.autenticar();
  }

  async #ensureToken() {
    if (this.token) return;
    const auth = await this.autenticar();
    if (!auth.ok) {
      const err = new Error(auth.message || "Falha na autenticação AT&M.");
      err.statusCode = 401;
      err.details = { httpStatus: auth.httpStatus };
      throw err;
    }
  }

  async #postXml(tipoDocumento, xml, { retriedAuth = false } = {}) {
    await this.#ensureToken();
    const path = this.documentoPath(tipoDocumento);
    const url = joinUrl(this.baseUrl, path);
    assertAmbienteUrl(this.ambiente, this.baseUrl);

    logger.info("AT&M envio XML", {
      ambiente: this.ambiente,
      path,
      tipoDocumento,
      xmlChars: String(xml || "").length,
    });

    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/xml",
          Authorization: `Bearer ${this.token}`,
        },
        body: String(xml || ""),
      });
    } catch (err) {
      return {
        httpStatus: null,
        response: null,
        timeout: Boolean(err.timeout),
        network: Boolean(err.network),
        rawBody: null,
      };
    }

    const rawBody = await res.text();
    const response = parseJsonSafe(rawBody);

    const expired =
      res.status === 401 ||
      String(response?.Erros?.Erro?.[0]?.Codigo || response?.Erros?.Erro?.Codigo || "") ===
        "915";
    if (expired && !retriedAuth) {
      this.token = null;
      await this.#ensureToken();
      return this.#postXml(tipoDocumento, xml, { retriedAuth: true });
    }

    return {
      httpStatus: res.status,
      response,
      timeout: false,
      network: false,
      rawBody: rawBody?.slice(0, 8000) ?? null,
    };
  }

  averbar({ xml, tipoDocumento }) {
    return this.#postXml(tipoDocumento, xml);
  }

  /**
   * Sem endpoint de consulta na REST v1.1. Reenvio idempotente do XML
   * protocolado (manual: "Documento já cadastrado" devolve protocolo).
   */
  consultar({ xml, tipoDocumento }) {
    return this.#postXml(tipoDocumento, xml);
  }

  cancelar({ xml, tipoDocumento }) {
    return this.#postXml(tipoDocumento, xml);
  }
}
