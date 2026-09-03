-- CT-e: grupo ICMSUFFim (partilha do ICMS / DIFAL para a UF de fim da
-- prestação) — item 1.3. Exigido quando: operação interestadual + tomador não
-- contribuinte de ICMS + tomador diferente do remetente. A obrigatoriedade é
-- validada em código no CteService, só na emissão nova (validarIcmsUfFimCte);
-- CT-e já emitidos não são afetados.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  -- UF de início/fim da prestação (ide.UFIni / ide.UFFim); base do teste de
  -- "operação interestadual"
  ADD COLUMN IF NOT EXISTS "uf_ini"              VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "uf_fim"              VARCHAR(2),
  -- Indicador da IE do tomador: 1 = contribuinte, 2 = isento, 9 = não contribuinte
  ADD COLUMN IF NOT EXISTS "tomador_ind_ie"      SMALLINT,
  -- Grupo ICMSUFFim
  ADD COLUMN IF NOT EXISTS "difal_vbc_uf_fim"    DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "difal_p_fcp_uf_fim"  DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "difal_p_icms_uf_fim" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "difal_p_icms_inter"  DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "difal_v_fcp_uf_fim"  DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "difal_v_icms_uf_fim" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "difal_v_icms_uf_ini" DECIMAL(14, 2);
