import https from "node:https";
import fs from "node:fs";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Client do provedor de CIOT (Declaração de Operação de Transporte).
 *
 * O provedor definitivo ainda não está decidido — pode ser a integração
 * direta com a ANTT ("CIOT Para Todos") ou um integrador homologado. Este
 * client isola a integração para que a escolha não vaze para nomes de classe,
 * variável de ambiente ou coluna do banco.
 *
 * Autenticação por mTLS: o certificado A1 (e-CNPJ) da empresa fiscal é
 * montado na própria conexão TLS via https.Agent — diferente do header Token
 * do provedor de CT-e/MDF-e. Cada chamada recebe { pfxPath, senha } (lidos de
 * fiscal_empresas.certificado_pfx_path / certificado_senha decifrada).
 *
 * O ambiente (homologação vs produção) vem de config.fiscal.ciotBaseUrl,
 * NUNCA do body da requisição.
 */

function serviceUnavailable(message) {
  const err = new Error(message);
  err.statusCode = 503;
  return err;
}

function buildAgent(certificado) {
  try {
    return new https.Agent({
      pfx: fs.readFileSync(certificado.pfxPath),
      passphrase: certificado.senha,
    });
  } catch (err) {
    logger.error("Falha ao carregar certificado digital para o CIOT", {
      pfxPath: certificado?.pfxPath,
      message: err.message,
    });
    throw serviceUnavailable(
      "Falha ao carregar o certificado digital configurado para a operação de CIOT",
    );
  }
}

function postJson(path, payload, certificado) {
  const baseUrl = config.fiscal.ciotBaseUrl;
  if (!baseUrl) {
    return Promise.reject(
      serviceUnavailable(
        "URL do provedor de CIOT não configurada — defina FISCAL_CIOT_URL.",
      ),
    );
  }
  if (!certificado?.pfxPath || !certificado?.senha) {
    return Promise.reject(
      serviceUnavailable(
        "Empresa fiscal sem certificado digital (pfx + senha) configurado para conexão mTLS com o provedor de CIOT",
      ),
    );
  }

  const agent = buildAgent(certificado);
  const body = JSON.stringify(payload);
  const url = new URL(`${baseUrl}${path}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        agent,
        timeout: config.fiscal.httpTimeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = { raw: text };
          }
          if (res.statusCode && res.statusCode >= 400) {
            logger.error("Provedor de CIOT respondeu erro HTTP", {
              path,
              status: res.statusCode,
            });
            reject(
              serviceUnavailable(
                `Falha ao comunicar com o provedor de CIOT (${path}): HTTP ${res.statusCode}`,
              ),
            );
            return;
          }
          resolve(data);
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err) => {
      logger.error("Falha ao chamar o provedor de CIOT", {
        path,
        message: err.message,
      });
      reject(
        serviceUnavailable(
          `Falha ao comunicar com o provedor de CIOT (${path}): ${err.message}`,
        ),
      );
    });

    req.write(body);
    req.end();
  });
}

export const CiotProviderClient = {
  declararOperacaoTransporte(payload, certificado) {
    return postJson("/DeclaracaoOperacaoTransporte", payload, certificado);
  },
  cancelarOperacaoTransporte(payload, certificado) {
    return postJson("/CancelamentoOperacaoTransporte", payload, certificado);
  },
  encerrarOperacaoTransporte(payload, certificado) {
    return postJson("/EncerramentoOperacaoTransporte", payload, certificado);
  },
  consultarSituacaoTransportador(payload, certificado) {
    return postJson("/ConsultarSituacaoTransportador", payload, certificado);
  },
  consultarCiotGerado(payload, certificado) {
    return postJson("/ConsultarCIOTGerado", payload, certificado);
  },
};
