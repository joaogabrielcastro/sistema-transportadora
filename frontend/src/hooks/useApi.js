// frontend/src/hooks/useApi.js
import { useState, useCallback, useRef } from "react";
import logger from "../utils/logger";
import { useToast } from "../components/ui/useToast.js";
import {
  api,
  apiFetch,
  getApiBaseUrl,
  parseApiError,
} from "../lib/apiClient.js";
import { queryClient } from "../lib/queryClient.js";

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

  const clearCache = useCallback(() => {
    logger.info("Cache invalidado manualmente");
    queryClient.invalidateQueries();
  }, []);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    clearError,
    clearCache,
    request,
  };
};

// Hook específico para recursos com paginação (legado — prefira React Query)
export const useApiResource = (baseUrl) => {
  const { loading, error, get, post, put, delete: del, clearError } = useApi();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  });

  const fetchAll = useCallback(
    async (params = {}) => {
      try {
        const response = await get(baseUrl, { params });

        if (response.success) {
          if (response.pagination) {
            setData(response.data);
            setPagination(response.pagination);
          } else if (Array.isArray(response.data)) {
            setData(response.data);
            setPagination({
              currentPage: 1,
              totalPages: 1,
              totalItems: response.data.length,
            });
          } else {
            setData([]);
          }
        }

        return response;
      } catch (err) {
        setData([]);
        throw err;
      }
    },
    [baseUrl, get],
  );

  const create = useCallback(
    async (item) => {
      const response = await post(baseUrl, item);
      if (response.success) {
        setData((prev) => [...prev, response.data]);
      }
      return response;
    },
    [baseUrl, post],
  );

  const update = useCallback(
    async (id, item) => {
      const response = await put(`${baseUrl}/${id}`, item);
      if (response.success) {
        setData((prev) => prev.map((i) => (i.id === id ? response.data : i)));
      }
      return response;
    },
    [baseUrl, put],
  );

  const remove = useCallback(
    async (id) => {
      const response = await del(`${baseUrl}/${id}`);
      if (response.success) {
        setData((prev) => prev.filter((i) => i.id !== id));
      }
      return response;
    },
    [baseUrl, del],
  );

  const search = useCallback(
    async (searchTerm) => {
      const response = await get(
        `${baseUrl}/search?term=${encodeURIComponent(searchTerm)}`,
      );
      return response;
    },
    [baseUrl, get],
  );

  return {
    data,
    loading,
    error,
    pagination,
    fetchAll,
    create,
    update,
    remove,
    search,
    clearError,
    setData,
  };
};
