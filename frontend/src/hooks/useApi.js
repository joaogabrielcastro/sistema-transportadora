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

/** Leituras ad hoc e requisições especiais (blob, preview, upload via request). */
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

        return await apiFetch(config);
      } catch (err) {
        const parsed = await parseApiError(err);
        setError(parsed.message);
        if (!config.skipErrorToast) {
          toast.error(parsed.message);
        }
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
    (url, config = {}) => request({ method: "GET", url, ...config }),
    [request],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    get,
    clearError,
    request,
  };
};
