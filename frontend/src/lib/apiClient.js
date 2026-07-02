import axios from "axios";
import logger from "../utils/logger.js";
import { invalidateQueriesFromMutation } from "./invalidateQueries.js";

const apiBaseUrlRaw =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

const apiToken = (import.meta.env.VITE_API_TOKEN || "").trim();
const apiBaseUrl = String(apiBaseUrlRaw).replace(/\/api\/?$/i, "");

export const getApiBaseUrl = () => apiBaseUrl;

export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const headers = axios.AxiosHeaders.from(config.headers || {});

  if (apiToken) {
    headers.set("Authorization", `Bearer ${apiToken}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isFormData) {
    headers.delete("Content-Type");
    config.headers = headers;
    return config;
  }

  const method = String(config.method || "get").toLowerCase();
  const sendsJsonBody =
    config.data != null &&
    typeof config.data === "object" &&
    !(config.data instanceof Blob) &&
    !(config.data instanceof ArrayBuffer);

  if (sendsJsonBody && ["post", "put", "patch"].includes(method)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  config.headers = headers;
  return config;
});

export const normalizeApiResponse = (response) => {
  if (response.status === 204) {
    return {
      success: true,
      data: null,
      message: "Operação concluída com sucesso",
    };
  }

  const payload = response.data;

  if (payload && typeof payload === "object" && "success" in payload) {
    return payload;
  }

  return {
    success: true,
    data: payload,
    message: "Operação realizada com sucesso",
  };
};

const retryRequest = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;

    if (error.response?.status >= 400) {
      if (error.response.status !== 408 && error.response.status !== 429) {
        throw error;
      }
    }

    logger.warn(`Retrying request... (${retries} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
};

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
      invalidateQueriesFromMutation(response.config.url, method);
    }
    return response;
  },
  (error) => {
    logger.error("API Error:", error);

    if (error.code === "ECONNABORTED") {
      const url = String(error.config?.url || "");
      const isOrdemPdf = /ordem-coleta\/pdf/.test(url);
      throw new Error(
        isOrdemPdf
          ? "Gerar PDF pode levar até 2 minutos. Aguarde e tente de novo uma vez."
          : "Servidor demorando para responder. Tente novamente em alguns segundos.",
      );
    }

    if (error.code === "ECONNREFUSED") {
      throw new Error(
        "Servidor não disponível. Verifique se o backend está rodando.",
      );
    }

    if (error.response) {
      throw error;
    }

    throw new Error("Erro de conexão com o servidor");
  },
);

/** Fetch sem toast/loading — para React Query e chamadas silenciosas. */
export async function apiFetch(config) {
  const response = await retryRequest(() => api(config));

  if (
    config.responseType === "blob" ||
    config.responseType === "arraybuffer"
  ) {
    return { success: true, data: response.data };
  }

  return normalizeApiResponse(response);
}

export async function parseApiError(err) {
  let errorMessage = err.message || "Erro desconhecido";
  let fieldErrors = null;
  const status = err.response?.status ?? null;

  if (err.response?.data) {
    let payload = err.response.data;

    if (typeof Blob !== "undefined" && payload instanceof Blob) {
      try {
        const text = await payload.text();
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (payload?.error) {
      errorMessage = payload.error;
    } else if (payload?.message) {
      errorMessage = payload.message;
    }

    if (payload?.details && Array.isArray(payload.details)) {
      if (typeof payload.details[0] === "string") {
        errorMessage += ": " + payload.details.join(", ");
        fieldErrors = Object.fromEntries(
          payload.details
            .map((line) => {
              const idx = String(line).indexOf(":");
              if (idx <= 0) return null;
              return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
            })
            .filter(Boolean),
        );
      } else {
        fieldErrors = Object.fromEntries(
          payload.details
            .map((d) => (d?.field ? [d.field, d.message] : null))
            .filter(Boolean),
        );
      }
    }
  }

  const e = new Error(errorMessage);
  e.status = status;
  e.fieldErrors = fieldErrors;
  return e;
}
