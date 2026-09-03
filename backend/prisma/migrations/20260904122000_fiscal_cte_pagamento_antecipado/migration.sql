-- CT-e: preparação para pagamento antecipado / split payment do frete
-- (NT2026.001 / NT2026.002) — item 1.3. Em 2026 o grupo ainda é OPCIONAL; a
-- coluna entra agora, como JSON genérico, apenas para não exigir nova migração
-- quando a NT passar a valer em 2027. É PREPARAÇÃO: a estrutura definitiva da
-- NT não está implementada — o conteúdo é passthrough puro para o provedor.
-- NENHUMA validação, não bloqueia emissão, emissões já feitas não são afetadas.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "pagamento_antecipado" JSONB;
