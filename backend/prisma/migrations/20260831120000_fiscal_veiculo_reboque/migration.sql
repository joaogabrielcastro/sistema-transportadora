-- Campos fiscais do reboque / semi-reboque no MDF-e (grupo veicReboque da SEFAZ).
--
-- O MDF-e rodoviário exige um grupo veicReboque para cada carreta quando o
-- veículo tracionado é um cavalo mecânico (rejeição 523 da SEFAZ). Guardamos
-- esses dados aqui, na extensão fiscal do caminhão, sem tocar em "caminhoes".
--
-- ALTER apenas em tabela NOSSA (fiscal_veiculo_dados, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN, todas nullable.
-- SQL idempotente (ADD COLUMN IF NOT EXISTS), estilo ATrack.

ALTER TABLE "fiscal_veiculo_dados"
  ADD COLUMN IF NOT EXISTS "renavam"         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "tara_kg"         INTEGER,
  ADD COLUMN IF NOT EXISTS "cap_kg"          INTEGER,
  ADD COLUMN IF NOT EXISTS "cap_m3"          DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "tipo_carroceria" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "uf"              VARCHAR(2);
