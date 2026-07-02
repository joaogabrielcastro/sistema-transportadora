// frontend/src/hooks/index.js
export { useApi, useApiResource, api, getApiBaseUrl } from "./useApi.js";
export { useCaminhoes } from "./useCaminhoes.js";
export {
  useCaminhoesListQuery,
  useReportsOverviewQuery,
  useManutencaoGastosQueries,
  useOrdemColetaHistoricoQuery,
  usePneusEmUsoQuery,
  usePneusEstoqueQuery,
  useStatusPneusQuery,
  usePosicoesPneusQuery,
  useCaminhaoDetailQuery,
  useEditGastoQuery,
  useEditChecklistQuery,
  useEditPneuQuery,
} from "./queries/index.js";
