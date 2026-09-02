-- MDF-e: dados estruturados do evento de cancelamento — item 2.3. Hoje só há
-- status = 'cancelado'. Guardar data/hora, protocolo e a justificativa usada dá
-- rastro do evento e permite reconciliação.
--
-- ALTER apenas em fiscal_mdfes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack. MDF-e já
-- cancelados antes desta migration ficam com estas colunas em NULL.

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "cancelado_em"            TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelado_protocolo"     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "cancelado_justificativa" VARCHAR(1000);
