// frontend/src/hooks/index.js
export { useApi } from "./useApi.js";
export { useApiMutation } from "./useApiMutation.js";
export { useDebouncedValue } from "./useDebouncedValue.js";
export { useFiscalDocDownload } from "./useFiscalDocDownload.js";
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
  useCaminhaoDetailQuery,
  useEditPneuQuery,
  useCteListQuery,
  useMdfeListQuery,
  useCiotListQuery,
  useFiscalClientesQuery,
  useFiscalEmpresasQuery,
  useFiscalVeiculoDadosQuery,
  useSaveFiscalVeiculoDadosMutation,
  useReboquesPreviewQuery,
} from "./queries/index.js";
