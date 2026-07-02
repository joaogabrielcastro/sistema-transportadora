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

const listAllParams = { page: 1, limit: API_CONFIG.LIST_MAX };

export function usePneuAtribuirQueries() {
  const estoque = usePneusEstoqueQuery(listAllParams);
  const caminhoes = useCaminhoesListQuery(listAllParams);
  const posicoes = usePosicoesPneusQuery();
  const status = useStatusPneusQuery();

  return {
    pneus: estoque.data?.data ?? [],
    caminhoes: caminhoes.data?.data ?? [],
    posicoes: posicoes.data ?? [],
    statusOptions: status.data ?? [],
    isLoading:
      estoque.isLoading ||
      caminhoes.isLoading ||
      posicoes.isLoading ||
      status.isLoading,
  };
}

export function useCadastroPneuLoteQueries() {
  const caminhoes = useCaminhoesListQuery({ page: 1, limit: 1000 });
  const posicoes = usePosicoesPneusQuery();
  const status = useStatusPneusQuery();

  return {
    caminhoes: caminhoes.data?.data ?? [],
    posicoes: posicoes.data ?? [],
    status: status.data ?? [],
    isLoading:
      caminhoes.isLoading || posicoes.isLoading || status.isLoading,
    error:
      caminhoes.error || posicoes.error || status.error
        ? "Erro ao carregar dados iniciais."
        : null,
  };
}
