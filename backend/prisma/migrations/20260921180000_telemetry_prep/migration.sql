-- Preparação para telemetria. Sem ingestão.
-- Idempotência: UNIQUE (device_id, event_id).
-- Vínculo aberto: no máximo um fim_em NULL por dispositivo e por veículo.

CREATE TABLE IF NOT EXISTS "telemetry_devices" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "external_id" VARCHAR(64) NOT NULL,
  "nome" VARCHAR(120),
  "credential_hash" VARCHAR(64) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "revogado_em" TIMESTAMPTZ(6),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_devices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_devices_credential_hash_key"
  ON "telemetry_devices"("credential_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_devices_tenant_id_external_id_key"
  ON "telemetry_devices"("tenant_id", "external_id");
CREATE INDEX IF NOT EXISTS "telemetry_devices_tenant_id_idx"
  ON "telemetry_devices"("tenant_id");
CREATE INDEX IF NOT EXISTS "telemetry_devices_tenant_id_ativo_idx"
  ON "telemetry_devices"("tenant_id", "ativo");

CREATE TABLE IF NOT EXISTS "telemetry_device_assignments" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "device_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER NOT NULL,
  "inicio_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "fim_em" TIMESTAMPTZ(6),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_device_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_device_assignments_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_device_assignments_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "telemetry_device_assignments_tenant_id_idx"
  ON "telemetry_device_assignments"("tenant_id");
CREATE INDEX IF NOT EXISTS "telemetry_device_assignments_device_id_inicio_em_idx"
  ON "telemetry_device_assignments"("device_id", "inicio_em");
CREATE INDEX IF NOT EXISTS "telemetry_device_assignments_caminhao_id_inicio_em_idx"
  ON "telemetry_device_assignments"("caminhao_id", "inicio_em");
CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_device_open_idx"
  ON "telemetry_device_assignments"("device_id") WHERE "fim_em" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_caminhao_open_idx"
  ON "telemetry_device_assignments"("caminhao_id") WHERE "fim_em" IS NULL;

CREATE TABLE IF NOT EXISTS "telemetry_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "device_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER,
  "event_id" VARCHAR(80) NOT NULL,
  "registrado_em" TIMESTAMPTZ(6) NOT NULL,
  "recebido_em" TIMESTAMPTZ(6) NOT NULL,
  "latitude" DECIMAL(9, 6),
  "longitude" DECIMAL(9, 6),
  "velocidade_kmh" DECIMAL(8, 2),
  "odometro_km" DECIMAL(14, 3),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_events_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_events_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_events_device_id_event_id_key"
  ON "telemetry_events"("device_id", "event_id");
CREATE INDEX IF NOT EXISTS "telemetry_events_tenant_id_registrado_em_idx"
  ON "telemetry_events"("tenant_id", "registrado_em");
CREATE INDEX IF NOT EXISTS "telemetry_events_caminhao_id_registrado_em_idx"
  ON "telemetry_events"("caminhao_id", "registrado_em");
CREATE INDEX IF NOT EXISTS "telemetry_events_device_id_registrado_em_idx"
  ON "telemetry_events"("device_id", "registrado_em");

CREATE TABLE IF NOT EXISTS "telemetry_current_state" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER NOT NULL,
  "device_id" INTEGER,
  "registrado_em" TIMESTAMPTZ(6) NOT NULL,
  "recebido_em" TIMESTAMPTZ(6) NOT NULL,
  "latitude" DECIMAL(9, 6),
  "longitude" DECIMAL(9, 6),
  "velocidade_kmh" DECIMAL(8, 2),
  "odometro_km" DECIMAL(14, 3),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_current_state_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_current_state_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_current_state_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_current_state_caminhao_id_key"
  ON "telemetry_current_state"("caminhao_id");
CREATE INDEX IF NOT EXISTS "telemetry_current_state_tenant_id_idx"
  ON "telemetry_current_state"("tenant_id");
CREATE INDEX IF NOT EXISTS "telemetry_current_state_device_id_idx"
  ON "telemetry_current_state"("device_id");

CREATE TABLE IF NOT EXISTS "telemetry_daily" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER NOT NULL,
  "dia" DATE NOT NULL,
  "km" DECIMAL(14, 3),
  "velocidade_max_kmh" DECIMAL(8, 2),
  "amostras" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_daily_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_daily_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_daily_tenant_id_caminhao_id_dia_key"
  ON "telemetry_daily"("tenant_id", "caminhao_id", "dia");
CREATE INDEX IF NOT EXISTS "telemetry_daily_tenant_id_dia_idx"
  ON "telemetry_daily"("tenant_id", "dia");
