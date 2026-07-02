import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

export function useCaminhoesListQuery(params = { page: 1, limit: 10 }) {
  return useQuery({
    queryKey: queryKeys.caminhoes.list(params),
    queryFn: async () => {
      const res = await apiFetch({
        method: "GET",
        url: "/caminhoes",
        params,
      });

      return {
        data: extractApiArray(res),
        pagination: res.pagination || null,
      };
    },
  });
}

export function useCaminhaoByPlacaQuery(placa) {
  return useQuery({
    queryKey: queryKeys.caminhoes.byPlaca(placa),
    enabled: Boolean(placa),
    queryFn: async () =>
      extractApiData(
        await apiFetch({ method: "GET", url: `/caminhoes/${placa}` }),
      ),
  });
}

export function useCaminhaoDocumentosQuery(placa) {
  return useQuery({
    queryKey: queryKeys.caminhoes.documentos(placa),
    enabled: Boolean(placa),
    queryFn: async () =>
      extractApiArray(
        await apiFetch({
          method: "GET",
          url: `/caminhoes/${placa}/documentos`,
        }),
      ),
  });
}
