import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";
import { API_CONFIG } from "../../utils/constants.js";
import { useCaminhoesListQuery } from "./useCaminhoesQuery.js";

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

export function usePneusEstoqueQuery({ page = 1, limit = 20, enabled = true } = {}) {
  const params = { page, limit };

  return useQuery({
    queryKey: queryKeys.pneus.estoque(params),
    enabled,
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

export function useStatusPneusQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.pneus.status,
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/status-pneus" }),
      ),
  });
}

export function usePosicoesPneusQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.pneus.posicoes,
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/posicoes-pneus" }),
      ),
  });
}

const listAllParams = { page: 1, limit: API_CONFIG.LIST_MAX };

export function usePneuAtribuirQueries({ enabled = true } = {}) {
  const estoque = usePneusEstoqueQuery({ ...listAllParams, enabled });
  const caminhoes = useCaminhoesListQuery(
    { ...listAllParams, page: 1, limit: API_CONFIG.LIST_MAX },
    { enabled },
  );
  const posicoes = usePosicoesPneusQuery({ enabled });
  const status = useStatusPneusQuery({ enabled });

  return {
    pneus: estoque.data?.data ?? [],
    caminhoes: caminhoes.data?.data ?? [],
    posicoes: posicoes.data ?? [],
    statusOptions: status.data ?? [],
    isLoading:
      enabled &&
      (estoque.isLoading ||
        caminhoes.isLoading ||
        posicoes.isLoading ||
        status.isLoading),
  };
}
