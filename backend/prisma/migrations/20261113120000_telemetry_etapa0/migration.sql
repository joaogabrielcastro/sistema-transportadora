-- Etapa 0: metadados de dispositivo, last_seen e índice para retenção do bruto.

ALTER TABLE "telemetry_devices"
  ADD COLUMN IF NOT EXISTS "manufacturer" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "model" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "imei" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "protocol" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "connection_type" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "ownership_type" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "telemetry_devices_tenant_id_last_seen_at_idx"
  ON "telemetry_devices"("tenant_id", "last_seen_at");

CREATE INDEX IF NOT EXISTS "telemetry_devices_tenant_id_imei_idx"
  ON "telemetry_devices"("tenant_id", "imei");

CREATE INDEX IF NOT EXISTS "telemetry_events_recebido_em_idx"
  ON "telemetry_events"("recebido_em");
