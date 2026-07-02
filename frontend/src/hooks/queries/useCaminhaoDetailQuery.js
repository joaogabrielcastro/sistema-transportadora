import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";
import { API_CONFIG } from "../../utils/constants.js";

function calcConsumoKmPorLitro(consumoData) {
  if (!consumoData || consumoData.length < 2) return null;

  const ultimo = consumoData[0];
  const penultimo = consumoData[1];
  const kmRodado = ultimo.km_registro - penultimo.km_registro;
  const litros = parseFloat(ultimo.quantidade_combustivel);

  if (litros > 0 && kmRodado > 0) {
    return (kmRodado / litros).toFixed(2);
  }

  return null;
}

export function useCaminhaoDetailQuery(placa) {
  return useQuery({
    queryKey: queryKeys.caminhoes.detail(placa),
    enabled: Boolean(placa),
    queryFn: async () => {
      const caminhaoRes = await apiFetch({
        method: "GET",
        url: `/caminhoes/${placa}`,
      });
      const caminhao = extractApiData(caminhaoRes);

      if (!caminhao?.id) {
        return {
          caminhao,
          gastos: [],
          checklists: [],
          pneus: [],
          consumoKmPorLitro: null,
          listTruncation: {
            gastos: false,
            checklists: false,
            gastosTotal: 0,
            checklistsTotal: 0,
          },
        };
      }

      const listLimit = API_CONFIG.LIST_MAX;
      const [gastosRes, checklistRes, pneusRes, consumoRes] =
        await Promise.all([
          apiFetch({
            method: "GET",
            url: `/gastos/caminhao/${caminhao.id}`,
            params: { limit: listLimit },
          }),
          apiFetch({
            method: "GET",
            url: `/checklist/caminhao/${caminhao.id}`,
            params: { limit: listLimit },
          }),
          apiFetch({
            method: "GET",
            url: `/pneus/caminhao/${caminhao.id}`,
            params: { limit: listLimit },
          }),
          apiFetch({
            method: "GET",
            url: `/gastos/consumo/${caminhao.id}`,
          }),
        ]);

      const gastosData = extractApiArray(gastosRes);
      const checklistData = extractApiArray(checklistRes);
      const pneusData = extractApiArray(pneusRes);
      const consumoData = extractApiArray(consumoRes);

      return {
        caminhao,
        gastos: gastosData,
        checklists: checklistData,
        pneus: pneusData,
        consumoKmPorLitro: calcConsumoKmPorLitro(consumoData),
        listTruncation: {
          gastos: Boolean(gastosRes?.meta?.truncated),
          checklists: Boolean(checklistRes?.meta?.truncated),
          gastosTotal: gastosRes?.meta?.total ?? gastosData.length,
          checklistsTotal: checklistRes?.meta?.total ?? checklistData.length,
        },
      };
    },
  });
}
