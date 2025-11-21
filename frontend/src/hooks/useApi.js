// frontend/src/hooks/useApi.js
import { useState, useCallback } from "react";
import axios from "axios";

// Configuração da API
export const api = axios.create({
  baseURL: `${
    import.meta.env.VITE_API_URL ||
    "https://sistema-transportadora.onrender.com"
  }/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptador para respostas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);

    if (error.code === "ECONNREFUSED") {
      throw new Error(
        "Servidor não disponível. Verifique se o backend está rodando."
      );
    }

    if (error.response) {
      // Retornar o erro original em vez de uma mensagem genérica
      throw error;
    }

    throw new Error("Erro de conexão");
  }
);

// Hook principal para requisições API
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (config) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api(config);

      // Verificar se a resposta tem a estrutura esperada
      if (response.data && typeof response.data === "object") {
        if (response.data.success !== undefined) {
          // Nova estrutura com success flag
          return response.data;
        } else {
          // Estrutura antiga, adaptar
          return {
            success: true,
            data: response.data,
            message: "Operação realizada com sucesso",
          };
        }
      }

      return response.data;
    } catch (err) {
      let errorMessage = err.message || "Erro desconhecido";

      // Tentar extrair mensagem detalhada do backend
      if (err.response?.data) {
        if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }

        // Se houver detalhes de validação (ex: Zod)
        if (
          err.response.data.details &&
          Array.isArray(err.response.data.details)
        ) {
          errorMessage += ": " + err.response.data.details.join(", ");
        }
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(
    (url, config = {}) => {
      return request({ method: "GET", url, ...config });
    },
    [request]
  );

  const post = useCallback(
    (url, data, config = {}) => {
      return request({ method: "POST", url, data, ...config });
    },
    [request]
  );

  const put = useCallback(
    (url, data, config = {}) => {
      return request({ method: "PUT", url, data, ...config });
    },
    [request]
  );

  const del = useCallback(
    (url, config = {}) => {
      return request({ method: "DELETE", url, ...config });
    },
    [request]
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

// Hook específico para recursos com paginação
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
          // Verificar se tem paginação
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
    [baseUrl, get]
  );

  const create = useCallback(
    async (item) => {
      const response = await post(baseUrl, item);
      if (response.success) {
        setData((prev) => [...prev, response.data]);
      }
      return response;
    },
    [baseUrl, post]
  );

  const update = useCallback(
    async (id, item) => {
      const response = await put(`${baseUrl}/${id}`, item);
      if (response.success) {
        setData((prev) => prev.map((i) => (i.id === id ? response.data : i)));
      }
      return response;
    },
    [baseUrl, put]
  );

  const remove = useCallback(
    async (id) => {
      const response = await del(`${baseUrl}/${id}`);
      if (response.success) {
        setData((prev) => prev.filter((i) => i.id !== id));
      }
      return response;
    },
    [baseUrl, del]
  );

  const search = useCallback(
    async (searchTerm) => {
      const response = await get(
        `${baseUrl}/search?term=${encodeURIComponent(searchTerm)}`
      );
      return response;
    },
    [baseUrl, get]
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
