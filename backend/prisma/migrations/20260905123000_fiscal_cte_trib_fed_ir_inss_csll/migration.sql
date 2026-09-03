-- CT-e: grupo TributosFederal do provedor aceita, além de PIS/COFINS (item 1.4 /
-- migration 20260904123000_fiscal_cte_trib_fed), os totalizadores de IR, INSS e
-- CSLL (item 0.8). São APENAS valores totalizadores (vIR / vINSS / vCSLL) —
-- nenhum cálculo é feito, nenhuma alíquota é hardcoded: passthrough puro do que
-- o emissor informar, mesma filosofia de pis_valor / cofins_valor. Opcionais,
-- sem validação de obrigatoriedade.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA). Somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack. CT-e já
-- emitidos não são afetados.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "ir_valor"   DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "inss_valor" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "csll_valor" DECIMAL(14, 2);
