-- pdf_path (DACTE / DAMDFE decodificado do base64 do provedor) em fiscal_ctes e
-- fiscal_mdfes, no mesmo padrão de xml_path. E cte_referenciado_id em
-- fiscal_ctes para o CT-e de Complemento de Valores (1) / Substituto (3)
-- apontar o CT-e original já emitido.
--
-- ALTER apenas em tabelas NOSSAS (prefixo fiscal_, criadas em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN, todas nullable.
-- SQL idempotente (ADD COLUMN IF NOT EXISTS + guarda DO $$), estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "pdf_path"            VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "cte_referenciado_id" INTEGER;

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "pdf_path" VARCHAR(500);

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_cte_referenciado_id_fkey"
    FOREIGN KEY ("cte_referenciado_id") REFERENCES "fiscal_ctes"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "fiscal_ctes_cte_referenciado_id_idx"
  ON "fiscal_ctes"("cte_referenciado_id");
