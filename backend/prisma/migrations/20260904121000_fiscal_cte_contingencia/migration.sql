-- CT-e: campos de contingência — item 1.2. dhCont (data/hora de entrada em
-- contingência) e xJust (justificativa). infSolicNFF (solicitação da NFF —
-- contingência raríssima, específica da Nota Fiscal Fácil) fica como JSON
-- genérico: a estrutura NÃO é modelada campo a campo porque depende do XSD
-- oficial. NENHUMA validação de obrigatoriedade — contingência é exceção.
-- Emissões já feitas não são afetadas (colunas nullable, sem default de valor).
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "dh_contingencia"            TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "justificativa_contingencia" VARCHAR(256),
  -- infSolicNFF: payload livre guardado para reprocessamento; estrutura exata
  -- pendente do XSD oficial (ver relatório).
  ADD COLUMN IF NOT EXISTS "inf_solic_nff"              JSONB;
