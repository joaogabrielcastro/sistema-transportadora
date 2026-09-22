-- Ignição do contrato mínimo de ingestão. Não mexe em km_atual nem em retenção.
ALTER TABLE "telemetry_events"
  ADD COLUMN IF NOT EXISTS "ignicao" BOOLEAN;

ALTER TABLE "telemetry_current_state"
  ADD COLUMN IF NOT EXISTS "ignicao" BOOLEAN;
