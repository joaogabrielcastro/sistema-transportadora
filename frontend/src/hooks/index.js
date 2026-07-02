// frontend/src/hooks/index.js
export { useApi, useApiResource, api, getApiBaseUrl } from "./useApi.js";
export { useCaminhoes } from "./useCaminhoes.js";
export {
  useCaminhoesListQuery,
  useCaminhaoByPlacaQuery,
  useReportsOverviewQuery,
  useCostPerKmReportQuery,
  useManutencaoGastosQueries,
  useOrdemColetaHistoricoQuery,
  usePneusEmUsoQuery,
  usePneusEstoqueQuery,
  useStatusPneusQuery,
  usePosicoesPneusQuery,
  usePneuAtribuirQueries,
  useCadastroPneuLoteQueries,
  useCaminhaoDetailQuery,
  useEditGastoQuery,
  useEditChecklistQuery,
  useEditPneuQuery,
} from "./queries/index.js";
