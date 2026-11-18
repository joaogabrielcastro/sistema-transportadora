import { useQuery } from "@tanstack/react-query";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiData } from "../../utils/extractApiArray.js";

/**
 * Pendências operacionais do tenant (GET /ops/alerts): documentos e CNHs a vencer,
 * pneus no fim da vida útil, manutenções programadas e gastos a pagar.
 * Compartilhado entre o sino do topo e o painel — uma única requisição em cache.
 */
export function useOpsAlertsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ops.alerts,
    queryFn: async () => {
      try {
        const res = await apiFetch({ url: "/ops/alerts" });
        const data = extractApiData(res) || {};
        return {
          alerts: Array.isArray(data.alerts) ? data.alerts : [],
          counts: data.counts || { total: 0, critical: 0, high: 0, medium: 0 },
        };
      } catch (err) {
        throw await parseApiError(err);
      }
    },
    enabled,
    staleTime: 60_000,
  });
}
