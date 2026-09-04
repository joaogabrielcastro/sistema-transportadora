import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

export function useEditPneuQuery(id) {
  return useQuery({
    queryKey: queryKeys.pneus.detail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      const [pneuRes, caminhoesRes, posicoesRes, statusRes] =
        await Promise.all([
          apiFetch({ method: "GET", url: `/pneus/${id}` }),
          apiFetch({ method: "GET", url: "/caminhoes" }),
          apiFetch({ method: "GET", url: "/posicoes-pneus" }),
          apiFetch({ method: "GET", url: "/status-pneus" }),
        ]);

      return {
        pneu: extractApiData(pneuRes),
        caminhoes: extractApiArray(caminhoesRes),
        posicoes: extractApiArray(posicoesRes),
        statusList: extractApiArray(statusRes),
      };
    },
  });
}
