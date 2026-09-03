-- CT-e — grupo imp.IBSCBS (Reforma Tributária): alíquotas de IBS (UF e
-- município) e de CBS. A migration 20260902120000_fiscal_cte_imp_ibscbs criou
-- apenas os campos de VALOR calculado (ibs_uf_valor / ibs_mun_valor / cbs_valor
-- / ibscbs_valor_total) e a base; as alíquotas do grupo (AliquotaIBSUF /
-- AliquotaIBSMun / AliquotaCBS no payload do provedor) não tinham coluna e por
-- isso não estavam sendo enviadas. Passam a ter — nullable, passthrough puro,
-- sem cálculo e sem obrigatoriedade nova.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN nullable. NENHUM ALTER
-- em tabela existente. SQL idempotente (ADD COLUMN IF NOT EXISTS), estilo
-- ATrack. CT-e já emitidos não são afetados.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "ibs_uf_aliquota"  DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "ibs_mun_aliquota" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "cbs_aliquota"     DECIMAL(7, 4);
