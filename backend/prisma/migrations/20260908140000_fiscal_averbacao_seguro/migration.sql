-- Averbação de seguro de transporte (AT&M como primeiro provedor).
-- Configuração 1:1 por tenant. Averbações isoladas por tenant_id.
-- Credenciais cifradas na aplicação (AES-256-GCM / FISCAL_SECRETS_KEY).
-- SQL idempotente.

CREATE TABLE IF NOT EXISTS "fiscal_seguro_config" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "provider" VARCHAR(32) NOT NULL DEFAULT 'atm',
  "ambiente" VARCHAR(16) NOT NULL DEFAULT 'homologacao',
  "automatico" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "seguradora" VARCHAR(80),
  "numero_apolice" VARCHAR(40),
  "tipo_cobertura" VARCHAR(40),
  "codigo_atm" VARCHAR(32),
  "usuario_encrypted" TEXT,
  "senha_encrypted" TEXT,
  "status_integracao" VARCHAR(20) NOT NULL DEFAULT 'inactive',
  "ultima_validacao_em" TIMESTAMPTZ(6),
  "ultima_validacao_erro" VARCHAR(500),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_seguro_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_seguro_config_tenant_id_key"
  ON "fiscal_seguro_config"("tenant_id");

CREATE INDEX IF NOT EXISTS "fiscal_seguro_config_tenant_id_idx"
  ON "fiscal_seguro_config"("tenant_id");

DO $$
BEGIN
  ALTER TABLE "fiscal_seguro_config"
    ADD CONSTRAINT "fiscal_seguro_config_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_seguro_config"
    ADD CONSTRAINT "fiscal_seguro_config_ambiente_check"
    CHECK ("ambiente" IN ('homologacao', 'producao'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "fiscal_averbacoes" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "cte_id" INTEGER,
  "mdfe_id" INTEGER,
  "tipo_documento" VARCHAR(8) NOT NULL,
  "operacao" VARCHAR(16) NOT NULL DEFAULT 'averbar',
  "provider" VARCHAR(32) NOT NULL,
  "ambiente" VARCHAR(16) NOT NULL,
  "chave_acesso" VARCHAR(44) NOT NULL,
  "seguradora" VARCHAR(80),
  "numero_apolice" VARCHAR(40),
  "external_id" VARCHAR(80),
  "protocolo" VARCHAR(40),
  "numero_averbacao" VARCHAR(40),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "request_meta" JSONB,
  "response_data" JSONB,
  "error_code" VARCHAR(20),
  "error_message" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "averbed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_averbacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_averbacoes_tenant_provider_tipo_chave_key"
  ON "fiscal_averbacoes"("tenant_id", "provider", "tipo_documento", "chave_acesso");

CREATE INDEX IF NOT EXISTS "fiscal_averbacoes_tenant_id_idx"
  ON "fiscal_averbacoes"("tenant_id");

CREATE INDEX IF NOT EXISTS "fiscal_averbacoes_tenant_cte_idx"
  ON "fiscal_averbacoes"("tenant_id", "cte_id");

CREATE INDEX IF NOT EXISTS "fiscal_averbacoes_tenant_mdfe_idx"
  ON "fiscal_averbacoes"("tenant_id", "mdfe_id");

CREATE INDEX IF NOT EXISTS "fiscal_averbacoes_tenant_status_idx"
  ON "fiscal_averbacoes"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "fiscal_averbacoes_chave_acesso_idx"
  ON "fiscal_averbacoes"("chave_acesso");

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_tipo_check"
    CHECK ("tipo_documento" IN ('cte', 'mdfe'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_status_check"
    CHECK ("status" IN ('pending', 'processing', 'averbed', 'rejected', 'cancelled', 'error'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fiscal_averbacoes"
    ADD CONSTRAINT "fiscal_averbacoes_ambiente_check"
    CHECK ("ambiente" IN ('homologacao', 'producao'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
