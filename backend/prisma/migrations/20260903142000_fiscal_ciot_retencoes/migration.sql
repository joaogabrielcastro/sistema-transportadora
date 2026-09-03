-- CIOT: retenções que devem constar no comprovante de pagamento — item 3.3.
-- INSS (~2,2% do frete bruto) e SEST/SENAT (~0,5%). Os percentuais NÃO são
-- fixados em código: vêm do corpo da declaração ou de variável de ambiente
-- (FISCAL_CIOT_RETENCAO_*_ALIQUOTA). Sem percentual informado, as colunas ficam
-- NULL e nada entra no comprovante. Confirmar o percentual exato com o contador.
--
-- ALTER apenas em fiscal_ciots (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ciots"
  -- base de cálculo das retenções (default: valor_frete, quando há alíquota)
  ADD COLUMN IF NOT EXISTS "retencao_base"               DECIMAL(14, 2),
  -- alíquotas gravadas como fração (ex.: 0.022 = 2,2%)
  ADD COLUMN IF NOT EXISTS "retencao_inss_aliquota"       DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "retencao_inss_valor"          DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "retencao_sest_senat_aliquota" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "retencao_sest_senat_valor"    DECIMAL(14, 2);
