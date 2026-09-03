-- CT-e — campos do grupo `imp` que o provedor aceita mas ainda não tinham
-- coluna. Todos confirmados no formato do provedor; nenhum é obrigatório e
-- nenhum é calculado (passthrough puro, só entram no payload quando preenchidos):
--
--  * icms_aliquota_outra_uf / icms_valor_outra_uf
--      -> Imposto.ICMS.AliquotaOutraUF / Imposto.ICMS.ValorICMSOutraUF
--  * icms_uf_fim_percentual_partilha
--      -> Imposto.Difal.PercentualPartilhaICMS (partilha do ICMS da UF de fim)
--  * ibscbs_percentual_reducao_ibs / ibscbs_percentual_reducao_cbs /
--    ibscbs_percentual_diferimento
--      -> Imposto.IBSCBS.PercentualReducaoIBS / .PercentualReducaoCBS /
--         .PercentualDiferimento
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN nullable. NENHUM ALTER
-- em tabela existente. SQL idempotente (ADD COLUMN IF NOT EXISTS), estilo
-- ATrack. CT-e já emitidos não são afetados.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "icms_aliquota_outra_uf"          DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "icms_valor_outra_uf"             DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "icms_uf_fim_percentual_partilha" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "ibscbs_percentual_reducao_ibs"   DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "ibscbs_percentual_reducao_cbs"   DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "ibscbs_percentual_diferimento"   DECIMAL(7, 4);
