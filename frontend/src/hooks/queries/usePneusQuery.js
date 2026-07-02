import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";

export function usePneusEmUsoQuery({
  page = 1,
  limit = 20,
  placa,
} = {}) {
  const params = {
    page,
    limit,
    emUso: true,
    ...(placa ? { placa } : {}),
  };

  return useQuery({
    queryKey: queryKeys.pneus.emUso(params),
    queryFn: async () => {
      const res = await apiFetch({
        method: "GET",
        url: "/pneus",
        params,
      });

      return {
        data: extractApiArray(res),
        pagination: res.pagination || null,
      };
    },
  });
}

export function usePneusEstoqueQuery({ page = 1, limit = 20 } = {}) {
  const params = { page, limit };

  return useQuery({
    queryKey: queryKeys.pneus.estoque(params),
    queryFn: async () => {
      const res = await apiFetch({
        method: "GET",
        url: "/pneus/in-stock",
        params,
      });

      return {
        data: extractApiArray(res),
        pagination: res.pagination || null,
        statusCounts: res?.meta?.statusCounts || [],
      };
    },
  });
}

export function useStatusPneusQuery() {
  return useQuery({
    queryKey: queryKeys.pneus.status,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/status-pneus" }),
      ),
  });
}

export function usePosicoesPneusQuery() {
  return useQuery({
    queryKey: queryKeys.pneus.posicoes,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/posicoes-pneus" }),
      ),
  });
}
