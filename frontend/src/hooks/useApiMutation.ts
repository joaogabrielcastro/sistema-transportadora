import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../components/ui/useToast.js";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import type {
  ApiFetchConfig,
  ApiSuccessResponse,
  ParsedApiError,
  UseApiMutationOptions,
} from "../types/api.js";

const defaultSuccessMessage = (method: string): string => {
  if (method === "POST") return "Salvo com sucesso.";
  if (method === "DELETE") return "Excluído com sucesso.";
  return "Atualizado com sucesso.";
};

/**
 * Mutações API com TanStack Query (loading, toast, invalidação via interceptor axios).
 */
export function useApiMutation(options: UseApiMutationOptions = {}) {
  const toast = useToast() as {
    success: (message: string) => void;
    error: (message: string) => void;
  };

  const mutation = useMutation({
    mutationFn: async (config: ApiFetchConfig) => {
      try {
        return await apiFetch(config);
      } catch (err) {
        throw await parseApiError(err);
      }
    },
    onSuccess: (data, variables) => {
      const method = String(variables.method || "POST").toUpperCase();
      const successData = data as ApiSuccessResponse;

      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        !variables.skipSuccessToast
      ) {
        toast.success(
          String(successData?.message || defaultSuccessMessage(method)),
        );
      }

      options.onSuccess?.(successData, variables);
    },
    onError: (err, variables) => {
      const parsed = err as ParsedApiError;
      if (!variables?.skipErrorToast) {
        toast.error(String(parsed.message || "Erro ao processar solicitação."));
      }
      options.onError?.(parsed, variables);
    },
  });

  const mutateAsync = mutation.mutateAsync;

  const post = useCallback(
    (url: string, data?: unknown, config: Partial<ApiFetchConfig> = {}) =>
      mutateAsync({ method: "POST", url, data, ...config }),
    [mutateAsync],
  );

  const put = useCallback(
    (url: string, data?: unknown, config: Partial<ApiFetchConfig> = {}) =>
      mutateAsync({ method: "PUT", url, data, ...config }),
    [mutateAsync],
  );

  const patch = useCallback(
    (url: string, data?: unknown, config: Partial<ApiFetchConfig> = {}) =>
      mutateAsync({ method: "PATCH", url, data, ...config }),
    [mutateAsync],
  );

  const del = useCallback(
    (url: string, config: Partial<ApiFetchConfig> = {}) =>
      mutateAsync({ method: "DELETE", url, ...config }),
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
    loading: mutation.isPending,
  };
}
