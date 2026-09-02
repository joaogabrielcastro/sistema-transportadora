import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

/**
 * Leituras do módulo fiscal de transporte (CT-e / MDF-e / clientes-tomadores).
 * Todas as rotas ficam atrás de requireFeature("transporte_fiscal") no backend.
 */

export function useCteListQuery({ status, enabled = true } = {}) {
  const params = status ? { status } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.cteList(params),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/cte", params }),
      ),
  });
}

export function useMdfeListQuery({ status, enabled = true } = {}) {
  const params = status ? { status } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.mdfeList(params),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/mdfe", params }),
      ),
  });
}

export function useFiscalClientesQuery({ q = "", enabled = true } = {}) {
  const params = q ? { q } : {};
  return useQuery({
    queryKey: queryKeys.fiscal.clientes(q),
    enabled,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({ method: "GET", url: "/fiscal/clientes", params }),
      ),
  });
}

/**
 * Extensão fiscal de um caminhão (dados do grupo veicReboque do MDF-e), 1 por
 * caminhão. A API devolve 404 quando ainda não há registro — aqui isso vira
 * `null` (formulário em branco), não erro.
 */
export function useFiscalVeiculoDadosQuery(caminhaoId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.fiscal.veiculoDados(caminhaoId),
    enabled: enabled && Boolean(caminhaoId),
    queryFn: async () => {
      try {
        return extractApiData(
          await apiFetch({
            method: "GET",
            url: `/fiscal/veiculo-dados/${caminhaoId}`,
          }),
        );
      } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
  });
}

/**
 * Pré-visualização read-only dos reboques que entrarão num MDF-e para o veículo
 * na data informada — mesma resolução (`resolveReboques`) usada na emissão. O
 * backend devolve `{ placa, tipo_veiculo, reboques, aviso }`; `aviso` traz a
 * pendência (sem dados fiscais, sem reboque, ...) sem estourar erro.
 */
export function useReboquesPreviewQuery({
  caminhaoId,
  dataEmissao,
  enabled = true,
} = {}) {
  const params = {};
  if (caminhaoId) params.caminhao_id = caminhaoId;
  if (dataEmissao) params.data_emissao = dataEmissao;
  return useQuery({
    queryKey: queryKeys.fiscal.reboquesPreview(params),
    enabled: enabled && Boolean(caminhaoId),
    queryFn: async () =>
      extractApiData(
        await apiFetch({
          method: "GET",
          url: "/fiscal/mdfe/reboques-preview",
          params,
        }),
      ),
  });
}

/**
 * Grava (upsert por caminhao_id) a extensão fiscal do caminhão. `caminhao_id`
 * vai no corpo; o backend cria ou atualiza o registro único.
 */
export function useSaveFiscalVeiculoDadosMutation(caminhaoId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      extractApiData(
        await apiFetch({
          method: "POST",
          url: "/fiscal/veiculo-dados",
          data: { ...payload, caminhao_id: Number(caminhaoId) },
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.fiscal.veiculoDados(caminhaoId),
        data,
      );
    },
  });
}
