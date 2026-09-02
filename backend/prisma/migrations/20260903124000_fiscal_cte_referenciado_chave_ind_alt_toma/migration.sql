-- CT-e Complemento (tipo 1) / Substituto (tipo 3) — item 1.5.
--
-- Hoje `cte_referenciado_id` é FK interna para fiscal_ctes e a chave de 44 do
-- CT-e original é resolvida na emissão a partir de fiscal_ctes.chave_acesso,
-- mas NÃO fica gravada na linha do complemento/substituto. Estas colunas:
--   * cte_referenciado_chave: snapshot da chave de 44 do CT-e original, para
--     auditoria e para montar infCteComp / infCteSub sem novo JOIN;
--   * ind_alt_toma: indAlteraToma do grupo infCteSub — indica que o Substituto
--     alterou o tomador em relação ao CT-e original. Só se aplica ao tipo 3.
-- A distinção Complemento x Substituto continua vindo de fiscal_ctes.status/
-- tipo do documento; o payload passa a mandar os grupos infCteComp / infCteSub
-- explicitamente (antes ia só um ChaveCteReferenciado genérico).
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "cte_referenciado_chave" VARCHAR(44),
  ADD COLUMN IF NOT EXISTS "ind_alt_toma"           BOOLEAN;
