-- MDF-e: grupo prodPred mais rico (item 0.3). CONFIRMADO com o payload real do
-- provedor. `prod_pred_tp_carga` já existe (migration
-- 20260902130000_fiscal_mdfe_seg_antt_tot_prodpred_ide). Faltavam:
--   * c_ean: GTIN do produto predominante ou a string "SEM GTIN"
--   * infLotacao: CEP + latitude/longitude do local de carregamento e do local
--     de descarregamento (usado quando a carga é de lotação).
--
-- ALTER apenas em fiscal_mdfes (tabela NOSSA). Somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack. MDF-e já
-- emitidos não são afetados.

ALTER TABLE "fiscal_mdfes"
  -- c_ean: até 14 dígitos (GTIN-14) ou o literal "SEM GTIN"
  ADD COLUMN IF NOT EXISTS "prod_pred_c_ean"                   VARCHAR(14),
  -- infLotacao: local de carregamento
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_carrega_cep"     VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_carrega_lat"     DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_carrega_long"    DECIMAL(10, 7),
  -- infLotacao: local de descarregamento
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_descarrega_cep"  VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_descarrega_lat"  DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "prod_pred_lotacao_descarrega_long" DECIMAL(10, 7);
