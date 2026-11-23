-- Comandos enviados ao rastreador (Teltonika Codec 12), ex.: bloqueio do motor.
-- Só adiciona tabela; idempotente.
CREATE TABLE IF NOT EXISTS "telemetry_device_commands" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "device_id" INTEGER NOT NULL,
  "caminhao_id" INTEGER,
  "acao" VARCHAR(32) NOT NULL,
  "comando" VARCHAR(120) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pendente',
  "resposta" TEXT,
  "erro" VARCHAR(255),
  "criado_por" INTEGER,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_em" TIMESTAMPTZ(6) NOT NULL,
  "enviado_em" TIMESTAMPTZ(6),
  "respondido_em" TIMESTAMPTZ(6),
  CONSTRAINT "telemetry_device_commands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_device_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_device_commands_caminhao_id_fkey" FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "telemetry_device_commands_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "telemetry_device_commands_device_id_status_idx" ON "telemetry_device_commands" ("device_id", "status");
CREATE INDEX IF NOT EXISTS "telemetry_device_commands_tenant_id_criado_em_idx" ON "telemetry_device_commands" ("tenant_id", "criado_em");
CREATE INDEX IF NOT EXISTS "telemetry_device_commands_caminhao_id_criado_em_idx" ON "telemetry_device_commands" ("caminhao_id", "criado_em");
