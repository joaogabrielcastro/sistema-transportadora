-- CT-e: grupo seg (seguro da carga) — item 1.6. No CT-e o grupo é opcional no
-- schema da SEFAZ (diferente do MDF-e), então NÃO há bloqueio de emissão por
-- ausência: é passthrough + persistência. Mesmos nomes de coluna do MDF-e
-- (fiscal_mdfes.seg_*), para reaproveitar a montagem do grupo (montarGrupoSeguro
-- em fiscalShared.js).
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  -- respSeg: responsável pelo seguro (mesma semântica do indicador da SEFAZ)
  ADD COLUMN IF NOT EXISTS "seg_responsavel"      SMALLINT,
  ADD COLUMN IF NOT EXISTS "seg_cnpj_seguradora"  VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "seg_numero_apolice"   VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "seg_numero_averbacao" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "seg_nome_seguradora"  VARCHAR(60);
