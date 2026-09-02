-- MDF-e: dados estruturados do evento de encerramento — item 2.2. Hoje só há
-- status = 'encerrado' e numero_protocolo. Guardar data/hora, UF e município do
-- encerramento evita MDF-e "pendente de encerramento" bloqueando nova emissão
-- para a mesma placa e dá rastro do evento.
--
-- ALTER apenas em fiscal_mdfes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack. MDF-e já
-- encerrados antes desta migration ficam com estas colunas em NULL.

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "encerrado_em"                TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "encerrado_uf"                VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "encerrado_codigo_municipio"  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "encerrado_nome_municipio"    VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "encerrado_protocolo"         VARCHAR(30);
