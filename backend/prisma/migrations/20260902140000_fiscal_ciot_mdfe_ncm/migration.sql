-- CIOT: mdfe_id opcional (3.2) e NCM da carga (3.4).
--
-- ALTER apenas em tabela NOSSA (fiscal_ciots, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN nullable. CIOTs sem
-- MDF-e continuam funcionando (mdfe_id NULL). SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ciots"
  -- FK -> fiscal_mdfes.id (opcional). O CIOT pode existir sem MDF-e vinculado.
  ADD COLUMN IF NOT EXISTS "mdfe_id"   INTEGER,
  ADD COLUMN IF NOT EXISTS "carga_ncm" VARCHAR(8);

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "fiscal_ciots_mdfe_id_idx"
  ON "fiscal_ciots"("mdfe_id");
