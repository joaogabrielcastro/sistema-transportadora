import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.ts";
import { extractApiArray } from "../../utils/extractApiArray.js";

const listaParams = { page: 1, limit: 200 };

export function useManutencaoGastosQueries({
  page = 1,
  limit = 20,
  placa = "",
} = {}) {
  const registrosParams = useMemo(
    () => ({
      page,
      limit,
      ...(placa.trim() ? { placa: placa.trim() } : {}),
    }),
    [page, limit, placa],
  );

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.caminhoes.list(listaParams),
        queryFn: async () => {
          const res = await apiFetch({
            method: "GET",
            url: "/caminhoes",
            params: listaParams,
          });
          return {
            data: extractApiArray(res),
            pagination: res.pagination || null,
          };
        },
      },
      {
        queryKey: queryKeys.manutencaoMeta.itens,
        queryFn: async () =>
          extractApiArray(
            await apiFetch({ method: "GET", url: "/itens-checklist" }),
          ),
      },
      {
        queryKey: queryKeys.manutencaoMeta.tipos,
        queryFn: async () =>
          extractApiArray(
            await apiFetch({ method: "GET", url: "/tipos-gastos" }),
          ),
      },
    ],
  });

  const registrosQuery = useQuery({
    queryKey: queryKeys.registros.list(registrosParams),
    queryFn: async () => {
      const res = await apiFetch({
        method: "GET",
        url: "/registros",
        params: registrosParams,
      });
      return {
        data: extractApiArray(res),
        pagination: res.pagination || null,
      };
    },
  });

  const [caminhoesQ, itensQ, tiposQ] = results;

  return {
    caminhoes: caminhoesQ.data?.data ?? [],
    itensChecklist: itensQ.data ?? [],
    tiposGastos: tiposQ.data ?? [],
    registros: registrosQuery.data?.data ?? [],
    pagination: registrosQuery.data?.pagination ?? null,
    isLoading:
      results.some((q) => q.isLoading) || registrosQuery.isLoading,
    isFetching:
      results.some((q) => q.isFetching) || registrosQuery.isFetching,
    error:
      results.find((q) => q.error)?.error ?? registrosQuery.error ?? null,
    refetch: () =>
      Promise.all([...results.map((q) => q.refetch()), registrosQuery.refetch()]),
  };
}
