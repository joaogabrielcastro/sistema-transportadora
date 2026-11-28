import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v != null && v !== false),
  );

export function useViagensListQuery(params = {}, options = {}) {
  const p = clean(params);
  return useQuery({
    queryKey: queryKeys.viagens.list(p),
    enabled: options.enabled !== false,
    placeholderData: (prev) => prev,
    queryFn: async () => extractApiData(await apiFetch({ method: "GET", url: "/viagens", params: p })),
  });
}

export function useViagensResumoQuery(params = {}, options = {}) {
  const p = clean(params);
  return useQuery({
    queryKey: queryKeys.viagens.resumo(p),
    enabled: options.enabled !== false,
    refetchInterval: options.refetchInterval ?? 60_000,
    queryFn: async () => extractApiData(await apiFetch({ method: "GET", url: "/viagens/resumo", params: p })),
  });
}

export function useViagensRelatorioQuery(params = {}, options = {}) {
  const p = clean(params);
  return useQuery({
    queryKey: queryKeys.viagens.relatorio(p),
    enabled: options.enabled !== false,
    queryFn: async () => extractApiData(await apiFetch({ method: "GET", url: "/viagens/relatorio", params: p })),
  });
}

export function useViagemQuery(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.viagens.detail(id),
    enabled: Boolean(id) && options.enabled !== false,
    queryFn: async () => extractApiData(await apiFetch({ method: "GET", url: `/viagens/${id}` })),
  });
}

export function useViagemHistoricoQuery(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.viagens.historico(id),
    enabled: Boolean(id) && options.enabled !== false,
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: `/viagens/${id}/historico` })),
  });
}

/** Mutação genérica do módulo: invalida listas, painel e a viagem. */
export function useViagemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ method, url, data, headers }) =>
      extractApiData(await apiFetch({ method, url, data, headers })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.viagens.all });
      await qc.invalidateQueries({ queryKey: queryKeys.caminhoes.all });
      await qc.invalidateQueries({ queryKey: queryKeys.gastos.all });
    },
  });
}

/** Monta o corpo da despesa: multipart quando há comprovante, JSON caso contrário. */
export function despesaPayload(values, file) {
  const body = {
    tipo_gasto_id: values.tipo_gasto_id,
    descricao: values.descricao,
    valor: values.valor,
    registrado_em: values.registrado_em,
    quantidade_combustivel: values.quantidade_combustivel ?? "",
    km_registro: values.km_registro ?? "",
    ...(values.motivo ? { motivo: values.motivo } : {}),
  };
  if (!file) {
    return {
      data: Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]),
      ),
    };
  }
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v !== "" && v != null) fd.append(k, String(v));
  }
  fd.append("comprovante", file);
  return { data: fd, headers: { "Content-Type": "multipart/form-data" } };
}
