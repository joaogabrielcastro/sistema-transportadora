-- Etapas 2–4: geocercas, alertas, campos CAN e assinatura do módulo.

ALTER TABLE "telemetry_events"
  ADD COLUMN IF NOT EXISTS "heading" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "altitude_m" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "engine_rpm" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "fuel_level_pct" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "fuel_consumed_l" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "engine_temp_c" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "engine_hours" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "battery_v" DECIMAL(6,2);

ALTER TABLE "telemetry_current_state"
  ADD COLUMN IF NOT EXISTS "heading" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "altitude_m" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "engine_rpm" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "fuel_level_pct" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "fuel_consumed_l" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "engine_temp_c" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "engine_hours" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "battery_v" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "geofence_status" VARCHAR(16);

ALTER TABLE "telemetry_daily"
  ADD COLUMN IF NOT EXISTS "fuel_consumed_l" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "engine_hours" DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS "telemetry_geofences" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "shape" VARCHAR(16) NOT NULL,
  "geometry" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_geofences_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "telemetry_geofences_tenant_id_idx"
  ON "telemetry_geofences"("tenant_id");
CREATE INDEX IF NOT EXISTS "telemetry_geofences_tenant_id_enabled_idx"
  ON "telemetry_geofences"("tenant_id", "enabled");

CREATE TABLE IF NOT EXISTS "telemetry_geofence_vehicles" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "geofence_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_geofence_vehicles_geofence_id_fkey"
    FOREIGN KEY ("geofence_id") REFERENCES "telemetry_geofences"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_geofence_vehicles_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_geofence_vehicles_geofence_id_caminhao_id_key"
  ON "telemetry_geofence_vehicles"("geofence_id", "caminhao_id");
CREATE INDEX IF NOT EXISTS "telemetry_geofence_vehicles_tenant_id_idx"
  ON "telemetry_geofence_vehicles"("tenant_id");
CREATE INDEX IF NOT EXISTS "telemetry_geofence_vehicles_caminhao_id_idx"
  ON "telemetry_geofence_vehicles"("caminhao_id");

CREATE TABLE IF NOT EXISTS "telemetry_alert_rules" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER,
  "alert_type" VARCHAR(32) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_alert_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_alert_rules_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "telemetry_alert_rules_tenant_id_enabled_idx"
  ON "telemetry_alert_rules"("tenant_id", "enabled");
CREATE INDEX IF NOT EXISTS "telemetry_alert_rules_tenant_id_alert_type_idx"
  ON "telemetry_alert_rules"("tenant_id", "alert_type");
CREATE INDEX IF NOT EXISTS "telemetry_alert_rules_caminhao_id_idx"
  ON "telemetry_alert_rules"("caminhao_id");

CREATE TABLE IF NOT EXISTS "telemetry_alerts" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER,
  "device_id" INTEGER,
  "geofence_id" INTEGER,
  "alert_type" VARCHAR(32) NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'warning',
  "description" VARCHAR(500) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "payload" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "resolved_at" TIMESTAMPTZ(6),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_alerts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_alerts_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_alerts_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_alerts_geofence_id_fkey"
    FOREIGN KEY ("geofence_id") REFERENCES "telemetry_geofences"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "telemetry_alerts_tenant_id_occurred_at_idx"
  ON "telemetry_alerts"("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "telemetry_alerts_tenant_id_status_idx"
  ON "telemetry_alerts"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "telemetry_alerts_caminhao_id_occurred_at_idx"
  ON "telemetry_alerts"("caminhao_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "telemetry_alerts_device_id_occurred_at_idx"
  ON "telemetry_alerts"("device_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "telemetry_subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "plan" VARCHAR(32) NOT NULL,
  "monthly_price" DECIMAL(12,2),
  "seat_limit" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "cancelled_at" TIMESTAMPTZ(6),
  "stripe_price_id" VARCHAR(255),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "telemetry_subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "telemetry_subscriptions_tenant_id_status_idx"
  ON "telemetry_subscriptions"("tenant_id", "status");
