-- Telemetria: guarda todos os IOs do rastreador e os eventos de condução.
-- Apenas adições (colunas opcionais e tabela nova). Nada existente é alterado.

-- 1) IOs brutos do rastreador (id -> valor), sinal GSM e satélites por ponto.
ALTER TABLE "telemetry_events"
  ADD COLUMN IF NOT EXISTS "io" JSONB,
  ADD COLUMN IF NOT EXISTS "satelites" SMALLINT,
  ADD COLUMN IF NOT EXISTS "gsm_sinal" SMALLINT,
  ADD COLUMN IF NOT EXISTS "ibutton" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "motorista_id" INTEGER;

ALTER TABLE "telemetry_current_state"
  ADD COLUMN IF NOT EXISTS "satelites" SMALLINT,
  ADD COLUMN IF NOT EXISTS "gsm_sinal" SMALLINT,
  ADD COLUMN IF NOT EXISTS "ibutton" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "motorista_id" INTEGER;

-- 2) Identificação do motorista por iButton (chaveiro 1-Wire, FMB130).
ALTER TABLE "motoristas"
  ADD COLUMN IF NOT EXISTS "ibutton_id" VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS "motoristas_tenant_ibutton_key"
  ON "motoristas" ("tenant_id", "ibutton_id")
  WHERE "ibutton_id" IS NOT NULL;

-- 3) Eventos de condução / segurança enviados pelo rastreador.
CREATE TABLE IF NOT EXISTS "telemetry_driving_events" (
  "id"            BIGSERIAL PRIMARY KEY,
  "tenant_id"     INTEGER NOT NULL,
  "device_id"     INTEGER NOT NULL,
  "caminhao_id"   INTEGER,
  "motorista_id"  INTEGER,
  "event_key"     VARCHAR(100) NOT NULL,
  "tipo"          VARCHAR(32) NOT NULL,
  "valor"         DECIMAL(10, 3),
  "velocidade_kmh" DECIMAL(8, 2),
  "latitude"      DECIMAL(9, 6),
  "longitude"     DECIMAL(9, 6),
  "ocorrido_em"   TIMESTAMPTZ(6) NOT NULL,
  "criado_em"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_driving_events_device_key"
  ON "telemetry_driving_events" ("device_id", "event_key");
CREATE INDEX IF NOT EXISTS "telemetry_driving_events_tenant_time_idx"
  ON "telemetry_driving_events" ("tenant_id", "ocorrido_em");
CREATE INDEX IF NOT EXISTS "telemetry_driving_events_caminhao_time_idx"
  ON "telemetry_driving_events" ("caminhao_id", "ocorrido_em");
CREATE INDEX IF NOT EXISTS "telemetry_driving_events_motorista_time_idx"
  ON "telemetry_driving_events" ("motorista_id", "ocorrido_em");

DO $$ BEGIN
  ALTER TABLE "telemetry_driving_events"
    ADD CONSTRAINT "telemetry_driving_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "telemetry_driving_events"
    ADD CONSTRAINT "telemetry_driving_events_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "telemetry_driving_events"
    ADD CONSTRAINT "telemetry_driving_events_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "telemetry_driving_events"
    ADD CONSTRAINT "telemetry_driving_events_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
