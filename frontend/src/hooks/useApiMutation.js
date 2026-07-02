import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../components/ui/useToast.js";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

const defaultSuccessMessage = (method) => {
  if (method === "POST") return "Salvo com sucesso.";
  if (method === "DELETE") return "Excluído com sucesso.";
  return "Atualizado com sucesso.";
};

/**
 * Mutações API com TanStack Query (loading, toast, invalidação via interceptor axios).
 */
export function useApiMutation(options = {}) {
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async (config) => {
      try {
        return await apiFetch(config);
      } catch (err) {
        throw await parseApiError(err);
      }
    },
    onSuccess: (data, variables) => {
      const method = String(variables.method || "POST").toUpperCase();

      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        !variables.skipSuccessToast
      ) {
        toast.success(data?.message || defaultSuccessMessage(method));
      }

      options.onSuccess?.(data, variables);
    },
    onError: (err, variables) => {
      if (!variables?.skipErrorToast) {
        toast.error(err.message || "Erro ao processar solicitação.");
      }
      options.onError?.(err, variables);
    },
  });

  const mutateAsync = mutation.mutateAsync;

  const post = useCallback(
    (url, data, config = {}) =>
      mutateAsync({ method: "POST", url, data, ...config }),
    [mutateAsync],
  );

  const put = useCallback(
    (url, data, config = {}) =>
      mutateAsync({ method: "PUT", url, data, ...config }),
    [mutateAsync],
  );

  const patch = useCallback(
    (url, data, config = {}) =>
      mutateAsync({ method: "PATCH", url, data, ...config }),
    [mutateAsync],
  );

  const del = useCallback(
    (url, config = {}) => mutateAsync({ method: "DELETE", url, ...config }),
    [mutateAsync],
  );

  return {
    mutate: mutation.mutate,
    mutateAsync,
    post,
    put,
    patch,
    delete: del,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    /** @deprecated use isPending */
    loading: mutation.isPending,
  };
}
