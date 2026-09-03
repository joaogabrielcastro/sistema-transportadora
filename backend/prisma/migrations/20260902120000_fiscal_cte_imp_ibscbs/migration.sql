-- Grupo `imp` do CT-e 4.0: ICMS + IBS/CBS (Reforma Tributária). O grupo IBSCBS
-- passou a ser exigido em produção pela SEFAZ desde 05/01/2026 para emitentes
-- fora do Simples Nacional. Guardamos aqui os campos que a validação de emissão
-- lê; o objeto `imposto` livre continua sendo repassado ao provedor sem alteração.
--
-- ALTER apenas em tabela NOSSA (fiscal_ctes, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN, todas nullable.
-- SQL idempotente (ADD COLUMN IF NOT EXISTS), estilo ATrack. Nenhuma coluna
-- existente alterada; emissões antigas não são afetadas.

ALTER TABLE "fiscal_ctes"
  -- ICMS (grupo imp.ICMS* do CT-e). icms_cst: 00, 20, 40, 41, 51, 90, ...
  ADD COLUMN IF NOT EXISTS "icms_cst"           VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "icms_base"          DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "icms_aliquota"      DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "icms_valor"         DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "icms_reducao_base"  DECIMAL(7, 4),
  -- IBS/CBS (grupo imp.IBSCBS do CT-e 4.0 — Reforma Tributária)
  ADD COLUMN IF NOT EXISTS "ibscbs_cst"          VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "ibscbs_c_class_trib" VARCHAR(6),
  ADD COLUMN IF NOT EXISTS "ibscbs_base"         DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "ibs_uf_valor"        DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "ibs_mun_valor"       DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "cbs_valor"           DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "ibscbs_valor_total"  DECIMAL(14, 2);
