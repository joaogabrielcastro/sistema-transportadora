import { config } from "../../../config/index.js";
import { logger } from "../../../utils/logger.js";

/**
 * Client HTTP centralizado da Brasil NFe (CT-e modelo 57 e MDF-e modelo 58).
 *
 * Documentação oficial:
 *  - https://www.brasilnfe.com.br/api/ct-e
 *  - https://www.brasilnfe.com.br/api/mdf-e
 *  - https://www.brasilnfe.com.br/api/empresas
 *  - https://www.brasilnfe.com.br/api/consultas
 *  - https://www.brasilnfe.com.br/autentication
 *
 * Autenticação: header `Token` (empresa) em operações fiscais;
 * `UserToken` + `Token` na seção Empresas (certificado).
 *
 * Ambiente (homologação/produção) NÃO muda a URL — vai no payload
 * (`TipoAmbiente` / `tipoAmbiente`: 1 produção, 2 homologação).
 *
 * Nunca logar Token, UserToken, senha ou certificado.
 */

const DEFAULT_BASE_URL = "https://api.brasilnfe.com.br/services";

const PATHS = Object.freeze({
  enviarCte: "/fiscal/EnviarConhecimentoTransporte",
  enviarMdfe: "/fiscal/EnviarManifestoTransporte",
  encerrarMdfe: "/fiscal/EncerrarManifestoTransporte",
  cancelar: "/fiscal/CancelarNotaFiscal",
  obterArquivo: "/fiscal/ObterArquivoNotaFiscal",
  obterNotas: "/fiscal/ObterNotasFiscais",
  alterarCertificado: "/empresa/AlterarCertificado",
  verificarCertificado: "/empresa/VerificarCertificado",
});

function serviceUnavailable(message) {
  const err = new Error(message);
  err.statusCode = 503;
  return err;
}

function providerError(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

/** Base URL sem barra final. Aceita BRASIL_NFE_BASE_URL ou o legado FISCAL_CTE_MDFE_URL. */
export function brasilNfeBaseUrl() {
  const raw = (config.fiscal.brasilNfeBaseUrl || "").trim().replace(/\/$/, "");
  return raw || DEFAULT_BASE_URL;
}

/**
 * Evita duplicar `/fiscal` quando a base antiga já termina em `/fiscal`
 * (FISCAL_CTE_MDFE_URL legado).
 */
export function joinBrasilNfeUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (b.endsWith("/fiscal") && p.startsWith("/fiscal/")) {
    return `${b}${p.slice("/fiscal".length)}`;
  }
  if (b.endsWith("/empresa") && p.startsWith("/empresa/")) {
    return `${b}${p.slice("/empresa".length)}`;
  }
  return `${b}${p}`;
}

function resolveUserToken(explicit) {
  const fromArg = String(explicit || "").trim();
  if (fromArg) return fromArg;
  return config.fiscal.brasilNfeUserToken;
}

function buildHeaders({ token, userToken, requireUserToken = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Token = token;
  const ut = resolveUserToken(userToken);
  if (ut) headers.UserToken = ut;
  if (requireUserToken && !ut) {
    throw serviceUnavailable(
      "UserToken da Brasil NFe não configurado — defina BRASIL_NFE_USER_TOKEN ou cadastre o UserToken na empresa fiscal.",
    );
  }
  return headers;
}

async function postJson(path, body, { token, userToken, requireUserToken = false } = {}) {
  const baseUrl = brasilNfeBaseUrl();
  if (!token && path.startsWith("/fiscal/")) {
    throw serviceUnavailable(
      "Empresa fiscal sem token da Brasil NFe — cadastre o Token da empresa antes de emitir.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.fiscal.httpTimeoutMs,
  );

  try {
    const response = await fetch(joinBrasilNfeUrl(baseUrl, path), {
      method: "POST",
      headers: buildHeaders({ token, userToken, requireUserToken }),
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      logger.error("Brasil NFe respondeu erro HTTP", {
        path,
        status: response.status,
      });
      const msg =
        (data && (data.Error || data.error || data.DsMotivo)) ||
        `Falha ao comunicar com a Brasil NFe (${path}): HTTP ${response.status}`;
      throw providerError(String(msg), {
        httpStatus: response.status,
        erros: data?.erros ?? data?.Avisos ?? [],
      });
    }

    return data;
  } catch (err) {
    if (err.statusCode === 503 || err.statusCode === 400) throw err;
    logger.error("Falha ao chamar a Brasil NFe", {
      path,
      message: err.message,
    });
    throw serviceUnavailable(
      `Falha ao comunicar com a Brasil NFe (${path}): ${err.message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const BrasilNFeClient = {
  paths: PATHS,

  /** POST /fiscal/EnviarConhecimentoTransporte */
  enviarConhecimentoTransporte(payload, token) {
    return postJson(PATHS.enviarCte, payload, { token });
  },

  /** POST /fiscal/EnviarManifestoTransporte */
  enviarManifestoTransporte(payload, token) {
    return postJson(PATHS.enviarMdfe, payload, { token });
  },

  /** POST /fiscal/EncerrarManifestoTransporte */
  encerrarManifestoTransporte(payload, token) {
    return postJson(PATHS.encerrarMdfe, payload, { token });
  },

  /** POST /fiscal/CancelarNotaFiscal — CT-e e MDF-e usam o mesmo evento. */
  cancelarNotaFiscal(payload, token) {
    return postJson(PATHS.cancelar, payload, { token });
  },

  /**
   * POST /fiscal/ObterArquivoNotaFiscal
   * FileType: 1 = XML, 2 = PDF. Resposta pode ser objeto JSON ou base64 puro.
   */
  obterArquivoNotaFiscal(payload, token) {
    return postJson(PATHS.obterArquivo, payload, { token });
  },

  /** POST /fiscal/ObterNotasFiscais — consulta por período / identificador interno. */
  obterNotasFiscais(payload, token) {
    return postJson(PATHS.obterNotas, payload, { token });
  },

  /**
   * POST /empresa/AlterarCertificado
   * Body oficial: { Senha, Base64CertificateFile }. Exige UserToken + Token.
   */
  alterarCertificado(payload, { token, userToken } = {}) {
    return postJson(PATHS.alterarCertificado, payload, {
      token,
      userToken,
      requireUserToken: true,
    });
  },

  /** POST /empresa/VerificarCertificado */
  verificarCertificado(payload, { token, userToken } = {}) {
    return postJson(PATHS.verificarCertificado, payload, {
      token,
      userToken,
      requireUserToken: true,
    });
  },
};
