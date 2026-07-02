import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";
import { API_CONFIG } from "../../utils/constants.js";

const listaParams = { page: 1, limit: API_CONFIG.LIST_MAX };

function formatRegistros(gastosData, checklistData) {
  const gastosFormatados = (Array.isArray(gastosData) ? gastosData : []).map(
    (g) => ({
      ...g,
      tipo_registro: "Gasto",
      nome_tipo: g.tipos_gastos?.nome_tipo,
      placa: g.caminhoes?.placa,
      data: g.data_gasto,
      observacao: g.descricao,
      oficina: "N/A",
      km_registro: g.km_registro || "N/A",
      quantidade_combustivel: g.quantidade_combustivel || "N/A",
    }),
  );

  const checklistFormatados = (
    Array.isArray(checklistData) ? checklistData : []
  ).map((c) => ({
    ...c,
    tipo_registro: "Manutenção",
    nome_tipo: c.itens_checklist?.nome_item,
    placa: c.caminhoes?.placa,
    data: c.data_manutencao,
    valor: c.valor || "N/A",
    observacao: c.observacao,
    oficina: c.oficina || "N/A",
    km_registro: c.km_manutencao || "N/A",
    quantidade_combustivel: "N/A",
  }));

  return [...gastosFormatados, ...checklistFormatados].sort(
    (a, b) => new Date(b.data) - new Date(a.data),
  );
}

export function useManutencaoGastosQueries() {
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
          return extractApiArray(res);
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
      {
        queryKey: queryKeys.gastos.list(listaParams),
        queryFn: async () => {
          const res = await apiFetch({
            method: "GET",
            url: "/gastos",
            params: listaParams,
          });
          return {
            data: extractApiArray(res),
            total: res?.pagination?.totalItems,
          };
        },
      },
      {
        queryKey: queryKeys.checklist.list(listaParams),
        queryFn: async () => {
          const res = await apiFetch({
            method: "GET",
            url: "/checklist",
            params: listaParams,
          });
          return {
            data: extractApiArray(res),
            total: res?.pagination?.totalItems,
          };
        },
      },
    ],
  });

  const [caminhoesQ, itensQ, tiposQ, gastosQ, checklistQ] = results;

  const registros = useMemo(() => {
    const gastosData = gastosQ.data?.data ?? [];
    const checklistData = checklistQ.data?.data ?? [];
    return formatRegistros(gastosData, checklistData);
  }, [gastosQ.data, checklistQ.data]);

  const listaTruncada = useMemo(() => {
    const gastosTotal = gastosQ.data?.total ?? gastosQ.data?.data?.length ?? 0;
    const checklistTotal =
      checklistQ.data?.total ?? checklistQ.data?.data?.length ?? 0;
    return (
      gastosTotal > API_CONFIG.LIST_MAX ||
      checklistTotal > API_CONFIG.LIST_MAX
    );
  }, [gastosQ.data, checklistQ.data]);

  return {
    caminhoes: caminhoesQ.data ?? [],
    itensChecklist: itensQ.data ?? [],
    tiposGastos: tiposQ.data ?? [],
    registros,
    listaTruncada,
    isLoading: results.some((q) => q.isLoading),
    isFetching: results.some((q) => q.isFetching),
    error: results.find((q) => q.error)?.error ?? null,
    refetch: () => Promise.all(results.map((q) => q.refetch())),
  };
}
