-- Gastos: campos de controle (motorista, status, vencimento) + detalhes JSON
-- por tipo (multa, pedágio, seguro, …). CT-e: número do contrato de frete
-- (CIOT) opcional, no mesmo espírito do MDF-e (fiscal_mdfes.antt_ciot).
--
-- ALTER só em tabelas NOSSAS (gastos, fiscal_ctes). Somente ADD COLUMN
-- nullable + FK opcional. SQL idempotente. Registros antigos não são afetados.

ALTER TABLE "gastos"
  ADD COLUMN IF NOT EXISTS "motorista_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "status_pagamento" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "data_vencimento" DATE,
  ADD COLUMN IF NOT EXISTS "detalhes" JSONB;

DO $$
BEGIN
  ALTER TABLE "gastos"
    ADD CONSTRAINT "gastos_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "gastos_motorista_id_idx"
  ON "gastos"("motorista_id");

CREATE INDEX IF NOT EXISTS "gastos_tenant_status_venc_idx"
  ON "gastos"("tenant_id", "status_pagamento", "data_vencimento");

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "antt_ciot" VARCHAR(20);
