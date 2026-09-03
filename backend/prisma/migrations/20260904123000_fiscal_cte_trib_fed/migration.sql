-- CT-e: grupo infTribFed (tributos federais) — item 1.4. APENAS os
-- totalizadores simples que existem de fato no schema do CT-e: vPIS e vCOFINS.
-- O CT-e NÃO tem CST / base de cálculo / alíquota detalhados de PIS/COFINS —
-- isso é da NF-e e não é replicado aqui. Colunas opcionais, sem validação de
-- obrigatoriedade; emissões já feitas não são afetadas.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "pis_valor"    DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "cofins_valor" DECIMAL(14, 2);
