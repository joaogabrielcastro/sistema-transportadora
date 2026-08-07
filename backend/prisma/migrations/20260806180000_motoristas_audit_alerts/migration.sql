-- Motoristas, docs validade, audit, onboarding/WhatsApp settings

-- Motoristas
CREATE TABLE IF NOT EXISTS "motoristas" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "cpf" VARCHAR(14),
  "cnh" VARCHAR(30),
  "cnh_categoria" VARCHAR(8),
  "cnh_validade" DATE,
  "telefone" VARCHAR(30),
  "whatsapp" VARCHAR(30),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacao" TEXT,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "motoristas_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "motoristas_tenant_id_idx" ON "motoristas"("tenant_id");
CREATE INDEX IF NOT EXISTS "motoristas_tenant_id_ativo_idx" ON "motoristas"("tenant_id", "ativo");
CREATE INDEX IF NOT EXISTS "motoristas_cnh_validade_idx" ON "motoristas"("cnh_validade");
CREATE UNIQUE INDEX IF NOT EXISTS "motoristas_tenant_cpf_key" ON "motoristas"("tenant_id", "cpf") WHERE "cpf" IS NOT NULL;

ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "motorista_id" INTEGER;
DO $$ BEGIN
  ALTER TABLE "caminhoes"
    ADD CONSTRAINT "caminhoes_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "caminhoes_motorista_id_idx" ON "caminhoes"("motorista_id");

-- Documentos: validade e tipo
ALTER TABLE "caminhao_documentos" ADD COLUMN IF NOT EXISTS "tipo_documento" VARCHAR(64);
ALTER TABLE "caminhao_documentos" ADD COLUMN IF NOT EXISTS "validade_em" DATE;
ALTER TABLE "caminhao_documentos" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
CREATE INDEX IF NOT EXISTS "caminhao_documentos_validade_em_idx" ON "caminhao_documentos"("validade_em");
CREATE INDEX IF NOT EXISTS "caminhao_documentos_tenant_validade_idx" ON "caminhao_documentos"("tenant_id", "validade_em");

-- Audit logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" INTEGER,
  "user_id" INTEGER,
  "user_email" VARCHAR(255),
  "action" VARCHAR(32) NOT NULL,
  "method" VARCHAR(16) NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "entity" VARCHAR(64),
  "entity_id" VARCHAR(64),
  "ip" VARCHAR(64),
  "request_id" VARCHAR(64),
  "summary" JSONB,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_criado_em_idx" ON "audit_logs"("criado_em");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_criado_idx" ON "audit_logs"("tenant_id", "criado_em");

-- Users: permissões extras (JSON array de strings)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '[]';

-- Tenants: onboarding + alertas + WhatsApp
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ(6);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "alert_email" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "whatsapp_notify_phone" VARCHAR(30);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "last_weekly_digest_at" TIMESTAMPTZ(6);
