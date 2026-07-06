import axios, { type AxiosResponse } from "axios";
import logger from "../utils/logger.js";
import { invalidateQueriesFromMutation } from "./invalidateQueries.js";
import { getAuthHeaderToken } from "./authStorage.js";
import type {
  ApiFetchConfig,
  ApiResponse,
  ApiSuccessResponse,
  ParsedApiError,
} from "../types/api.js";

const apiBaseUrlRaw =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

const apiBaseUrl = String(apiBaseUrlRaw).replace(/\/api\/?$/i, "");

export const getApiBaseUrl = (): string => apiBaseUrl;

export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const headers = axios.AxiosHeaders.from(config.headers || {});

  const bearer = getAuthHeaderToken();
  if (bearer) {
    headers.set("Authorization", `Bearer ${bearer}`);
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

export const normalizeApiResponse = <T>(
  response: AxiosResponse,
): ApiSuccessResponse<T> => {
  if (response.status === 204) {
    return {
      success: true,
      data: null as T,
      message: "Operação concluída com sucesso",
    };
  }

  const payload = response.data;

  if (payload && typeof payload === "object" && "success" in payload) {
    return payload as ApiSuccessResponse<T>;
  }

  return {
    success: true,
    data: payload as T,
    message: "Operação realizada com sucesso",
  };
};

const retryRequest = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;

    const axiosError = error as { response?: { status?: number } };
    if (axiosError.response?.status && axiosError.response.status >= 400) {
      if (
        axiosError.response.status !== 408 &&
        axiosError.response.status !== 429
      ) {
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
    if (method && ["post", "put", "patch", "delete"].includes(method)) {
      invalidateQueriesFromMutation(response.config.url, method);
    }
    return response;
  },
  (error) => {
    logger.error("API Error:", error);

    const axiosError = error as {
      code?: string;
      config?: { url?: string };
      response?: unknown;
    };

    if (axiosError.code === "ECONNABORTED") {
      const url = String(axiosError.config?.url || "");
      const isOrdemPdf = /ordem-coleta\/pdf/.test(url);
      throw new Error(
        isOrdemPdf
          ? "Gerar PDF pode levar até 2 minutos. Aguarde e tente de novo uma vez."
          : "Servidor demorando para responder. Tente novamente em alguns segundos.",
      );
    }

    if (axiosError.code === "ECONNREFUSED") {
      throw new Error(
        "Servidor não disponível. Verifique se o backend está rodando.",
      );
    }

    if (axiosError.response) {
      throw error;
    }

    throw new Error("Erro de conexão com o servidor");
  },
);

/** Fetch sem toast/loading — para React Query e chamadas silenciosas. */
export async function apiFetch<T = unknown>(
  config: ApiFetchConfig,
): Promise<ApiResponse<T>> {
  const response = await retryRequest(() => api(config));

  if (
    config.responseType === "blob" ||
    config.responseType === "arraybuffer"
  ) {
    return { success: true, data: response.data as T };
  }

  return normalizeApiResponse<T>(response);
}

export async function parseApiError(err: unknown): Promise<ParsedApiError> {
  const axiosErr = err as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };

  let errorMessage = axiosErr.message || "Erro desconhecido";
  let fieldErrors: Record<string, string> | null = null;
  const status = axiosErr.response?.status ?? null;

  if (axiosErr.response?.data) {
    let payload: unknown = axiosErr.response.data;

    if (typeof Blob !== "undefined" && payload instanceof Blob) {
      try {
        const text = await payload.text();
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }

    const body = payload as {
      error?: string;
      message?: string;
      details?: string[] | Array<{ field?: string; message?: string }>;
    };

    if (body?.error) {
      errorMessage = body.error;
    } else if (body?.message) {
      errorMessage = body.message;
    }

    if (body?.details && Array.isArray(body.details)) {
      if (typeof body.details[0] === "string") {
        const stringDetails = body.details as string[];
        errorMessage += ": " + stringDetails.join(", ");
        fieldErrors = Object.fromEntries(
          stringDetails
            .map((line) => {
              const idx = String(line).indexOf(":");
              if (idx <= 0) return null;
              return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
            })
            .filter((entry): entry is [string, string] => entry !== null),
        );
      } else {
        const objectDetails = body.details as Array<{
          field?: string;
          message?: string;
        }>;
        fieldErrors = Object.fromEntries(
          objectDetails
            .map((d) => (d?.field ? [d.field, d.message ?? ""] : null))
            .filter((entry): entry is [string, string] => entry !== null),
        );
      }
    }
  }

  const e = new Error(errorMessage) as ParsedApiError;
  e.status = status;
  e.fieldErrors = fieldErrors;
  return e;
}
