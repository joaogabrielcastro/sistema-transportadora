import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Client HTTP do provedor externo de CT-e e MDF-e.
 *
 * O provedor definitivo ainda não está decidido — este client isola a
 * integração para que trocar de fornecedor não vaze para nomes de classe,
 * variável de ambiente ou coluna do banco. Estilo ATrack: função simples,
 * sem classe injetável, recebe os dados já validados pelo controller. O token
 * de acesso é por empresa fiscal (fiscal_empresas.cte_mdfe_provider_token,
 * decifrado) e chega como argumento — não há token global de ambiente.
 *
 * Endpoints (contrato atual, no estilo do provedor avaliado):
 *  - POST /EnviarConhecimentoTransporte  (emissão CT-e)
 *  - POST /EnviarManifestoTransporte     (emissão MDF-e)
 *  - POST /EncerrarManifestoTransporte   (encerramento MDF-e)
 *  - POST /CancelarNotaFiscal            (cancelamento CT-e e MDF-e — mesmo shape)
 */

function serviceUnavailable(message) {
  const err = new Error(message);
  err.statusCode = 503;
  return err;
}

async function postJson(path, body, token) {
  const baseUrl = config.fiscal.cteMdfeBaseUrl;
  if (!baseUrl) {
    throw serviceUnavailable(
      "URL do provedor de CT-e/MDF-e não configurada — defina FISCAL_CTE_MDFE_URL.",
    );
  }
  if (!token) {
    throw serviceUnavailable(
      "Empresa fiscal sem token do provedor de CT-e/MDF-e configurado — cadastre o token antes de emitir.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.fiscal.httpTimeoutMs,
  );

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Token: token,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      logger.error("Provedor de CT-e/MDF-e respondeu erro HTTP", {
        path,
        status: response.status,
      });
      throw serviceUnavailable(
        `Falha ao comunicar com o provedor de CT-e/MDF-e (${path}): HTTP ${response.status}`,
      );
    }

    return data;
  } catch (err) {
    if (err.statusCode === 503) throw err;
    logger.error("Falha ao chamar o provedor de CT-e/MDF-e", {
      path,
      message: err.message,
    });
    throw serviceUnavailable(
      `Falha ao comunicar com o provedor de CT-e/MDF-e (${path}): ${err.message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const CteMdfeProviderClient = {
  /** @returns {Promise<{serie?:string,numero?:string|number,chave?:string,protocolo?:string|number,base64Xml?:string,base64DACTe?:string,erros?:string[],avisos?:string[],status?:number}>} */
  enviarConhecimentoTransporte(payload, token) {
    return postJson("/EnviarConhecimentoTransporte", payload, token);
  },

  /** @returns {Promise<{numero?:number,chave?:string,status?:number,base64Xml?:string,base64DAMDFe?:string,Error?:string,Avisos?:string[]}>} */
  enviarManifestoTransporte(payload, token) {
    return postJson("/EnviarManifestoTransporte", payload, token);
  },

  /**
   * Encerramento do MDF-e (0.5). Corpo confirmado no payload real do provedor:
   * { tipoAmbiente, chave, protocolo, numeroSequencial }.
   * @returns {Promise<{Status?:number,Error?:string,NuProtocolo?:string,Avisos?:string[]}>}
   */
  encerrarManifestoTransporte(payload, token) {
    return postJson("/EncerrarManifestoTransporte", payload, token);
  },

  /**
   * Cancelamento genérico (CT-e e MDF-e) — item 0.6. Corpo:
   * { ChaveNF, Justificativa, NumeroProtocolo, NumeroSequencial, DataEvento,
   *   CpfCnpjRemetenteDCe }.
   * @returns {Promise<{Status?:number,Error?:string,NuProtocolo?:string,Avisos?:string[]}>}
   */
  cancelarNotaFiscal(payload, token) {
    return postJson("/CancelarNotaFiscal", payload, token);
  },
};
