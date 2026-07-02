import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

export function useEditGastoQuery(id) {
  return useQuery({
    queryKey: queryKeys.gastos.detail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      const [gastoRes, tiposRes, caminhoesRes] = await Promise.all([
        apiFetch({ method: "GET", url: `/gastos/${id}` }),
        apiFetch({ method: "GET", url: "/tipos-gastos" }),
        apiFetch({ method: "GET", url: "/caminhoes" }),
      ]);

      return {
        gasto: extractApiData(gastoRes),
        tiposGastos: extractApiArray(tiposRes),
        caminhoes: extractApiArray(caminhoesRes),
      };
    },
  });
}

export function useEditChecklistQuery(id) {
  return useQuery({
    queryKey: queryKeys.checklist.detail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      const [checklistRes, caminhoesRes, itensRes] = await Promise.all([
        apiFetch({ method: "GET", url: `/checklist/${id}` }),
        apiFetch({ method: "GET", url: "/caminhoes" }),
        apiFetch({ method: "GET", url: "/itens-checklist" }),
      ]);

      return {
        checklist: extractApiData(checklistRes),
        caminhoes: extractApiArray(caminhoesRes),
        itensChecklist: extractApiArray(itensRes),
      };
    },
  });
}

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
