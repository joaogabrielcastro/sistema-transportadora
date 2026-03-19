-- This migration was generated manually because local DB access was unavailable.
-- Apply in environments where the Postgres database is reachable.

-- caminhoes
ALTER TABLE "caminhoes"
  ALTER COLUMN "placa_carreta_1" TYPE varchar(10),
  ALTER COLUMN "placa_carreta_2" TYPE varchar(10);

-- checklist.valor precision
ALTER TABLE "checklist"
  ALTER COLUMN "valor" TYPE numeric(10,2);

-- indexes (Postgres)
CREATE INDEX IF NOT EXISTS "checklist_caminhao_id_idx" ON "checklist" ("caminhao_id");
CREATE INDEX IF NOT EXISTS "checklist_data_manutencao_idx" ON "checklist" ("data_manutencao");

CREATE INDEX IF NOT EXISTS "gastos_caminhao_id_idx" ON "gastos" ("caminhao_id");
CREATE INDEX IF NOT EXISTS "gastos_data_gasto_idx" ON "gastos" ("data_gasto");
CREATE INDEX IF NOT EXISTS "gastos_tipo_gasto_id_idx" ON "gastos" ("tipo_gasto_id");
CREATE INDEX IF NOT EXISTS "gastos_caminhao_id_data_gasto_idx" ON "gastos" ("caminhao_id", "data_gasto");

CREATE INDEX IF NOT EXISTS "pneus_caminhao_id_idx" ON "pneus" ("caminhao_id");
CREATE INDEX IF NOT EXISTS "pneus_status_id_idx" ON "pneus" ("status_id");
CREATE INDEX IF NOT EXISTS "pneus_posicao_id_idx" ON "pneus" ("posicao_id");

