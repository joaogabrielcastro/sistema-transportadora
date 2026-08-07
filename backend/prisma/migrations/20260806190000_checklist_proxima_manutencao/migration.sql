-- Lembrete da próxima manutenção (óleo, lubrificação, etc.)
ALTER TABLE "checklist" ADD COLUMN IF NOT EXISTS "proxima_km" INTEGER;
ALTER TABLE "checklist" ADD COLUMN IF NOT EXISTS "proxima_data" DATE;

CREATE INDEX IF NOT EXISTS "checklist_proxima_data_idx" ON "checklist"("proxima_data");
