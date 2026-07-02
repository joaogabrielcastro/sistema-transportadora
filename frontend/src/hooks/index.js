// frontend/src/hooks/index.js
export { useApi, api, getApiBaseUrl } from "./useApi.js";
export { useApiMutation } from "./useApiMutation.js";
export { useDebouncedValue } from "./useDebouncedValue.js";
export {
  useCaminhoesListQuery,
  useCaminhaoByPlacaQuery,
  useCaminhaoDocumentosQuery,
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
