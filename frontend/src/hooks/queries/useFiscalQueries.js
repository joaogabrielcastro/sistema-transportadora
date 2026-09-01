import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";

/**
 * Leituras do módulo fiscal de transporte (CT-e / MDF-e / clientes-tomadores).
 * Todas as rotas ficam atrás de requireFeature("transporte_fiscal") no backend.
 */

export function useCteListQuery({ status, enabled = true } = {}) {
  const params = status ? { status } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.cteList(params),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/cte", params }),
      ),
  });
}

export function useMdfeListQuery({ status, enabled = true } = {}) {
  const params = status ? { status } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.mdfeList(params),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/mdfe", params }),
      ),
  });
}

export function useFiscalClientesQuery({ q = "", enabled = true } = {}) {
  const params = q ? { q } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.clientes(q),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/clientes", params }),
      ),
  });
}
