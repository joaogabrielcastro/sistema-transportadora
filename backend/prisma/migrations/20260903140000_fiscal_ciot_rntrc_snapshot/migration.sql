-- CIOT: snapshot da situação do RNTRC do transportador contratado no momento da
-- operação — item 3.1. O RNTRC pode ser suspenso depois da declaração; guardar
-- a situação (ativo / suspenso / ...) declarada dá base de auditoria.
--
-- Nesta rodada NÃO há consulta automática à ANTT: o CiotService só grava o que
-- vier no corpo da declaração (rntrc_contratado_situacao / _snapshot). A
-- consulta automática fica de follow-up, depois de o certificado/sandbox estar
-- validado.
--
-- ALTER apenas em fiscal_ciots (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ciots"
  ADD COLUMN IF NOT EXISTS "rntrc_contratado_situacao"    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "rntrc_contratado_situacao_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rntrc_contratado_snapshot"    JSONB;
