import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";

export function useOrdemColetaHistoricoQuery(page = 1) {
  return useQuery({
    queryKey: queryKeys.ordemColeta.historico(page),
    queryFn: async () => {
      const res = await apiFetch({
        method: "GET",
        url: "/ordem-coleta/historico",
        params: { page, limit: 15 },
      });

      return {
        rows: Array.isArray(res.data) ? res.data : [],
        pagination: res.pagination || null,
      };
    },
    refetchInterval: (query) => {
      const rows = query.state.data?.rows ?? [];
      return rows.some((row) => row.status === "processing") ? 4000 : false;
    },
  });
}
