import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";

function hasProcessingRows(rows) {
  return (rows ?? []).some(
    (row) =>
      row?.status === "processing" ||
      (!row?.enviado_em && !row?.erro_envio && !row?.status),
  );
}

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
        totalFalhas: res.totalFalhas ?? 0,
      };
    },
    // Sem staleTime longo: senão o status fica em Processando… até hard refresh
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (query) => {
      const rows = query.state.data?.rows ?? [];
      return hasProcessingRows(rows) ? 2500 : false;
    },
  });
}
