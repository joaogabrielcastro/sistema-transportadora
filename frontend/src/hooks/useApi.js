// frontend/src/hooks/useApi.js
import { useState, useCallback, useRef } from "react";
import { useToast } from "../components/ui/useToast.js";
import {
  api,
  apiFetch,
  getApiBaseUrl,
  parseApiError,
} from "../lib/apiClient.js";

export { api, getApiBaseUrl };

// Hook principal para requisições API (mutações com toast/loading)
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const pendingRequestsRef = useRef(0);

  const request = useCallback(
    async (config) => {
      const trackLoading = config.skipLoading !== true;

      try {
        if (trackLoading) {
          pendingRequestsRef.current += 1;
          setLoading(true);
        }
        setError(null);

        const normalized = await apiFetch(config);

        const method = String(config.method || "GET").toUpperCase();
        if (
          ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
          !config.skipSuccessToast
        ) {
          const message =
            normalized?.message ||
            (method === "POST"
              ? "Salvo com sucesso."
              : method === "DELETE"
                ? "Excluído com sucesso."
                : "Atualizado com sucesso.");
          toast.success(message);
        }

        return normalized;
      } catch (err) {
        const parsed = await parseApiError(err);
        setError(parsed.message);
        toast.error(parsed.message);
        throw parsed;
      } finally {
        if (trackLoading) {
          pendingRequestsRef.current = Math.max(
            0,
            pendingRequestsRef.current - 1,
          );
          if (pendingRequestsRef.current === 0) {
            setLoading(false);
          }
        }
      }
    },
    [toast],
  );

  const get = useCallback(
    (url, config = {}) => {
      return request({ method: "GET", url, ...config });
    },
    [request],
  );

  const post = useCallback(
    (url, data, config = {}) => {
      return request({ method: "POST", url, data, ...config });
    },
    [request],
  );

  const put = useCallback(
    (url, data, config = {}) => {
      return request({ method: "PUT", url, data, ...config });
    },
    [request],
  );

  const del = useCallback(
    (url, config = {}) => {
      return request({ method: "DELETE", url, ...config });
    },
    [request],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    clearError,
    request,
  };
};
