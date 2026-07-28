-- Multi-tenant: shared DB + tenant_id (seed abbroto for existing data)

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants"("slug");

INSERT INTO "tenants" ("nome", "slug", "ativo")
SELECT 'ABroto', 'abbroto', true
WHERE NOT EXISTS (SELECT 1 FROM "tenants" WHERE "slug" = 'abbroto');

-- Add nullable tenant_id columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "checklist" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "pneus" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "ordens_coleta_envio" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;
ALTER TABLE "caminhao_documentos" ADD COLUMN IF NOT EXISTS "tenant_id" INTEGER;

-- Backfill with seed tenant
UPDATE "users" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "caminhoes" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "gastos" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "checklist" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "pneus" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "ordens_coleta_envio" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "caminhao_documentos" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'abbroto' LIMIT 1) WHERE "tenant_id" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "gastos" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "checklist" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "pneus" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "ordens_coleta_envio" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "caminhao_documentos" ALTER COLUMN "tenant_id" SET NOT NULL;

-- FKs
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "gastos" ADD CONSTRAINT "gastos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklist" ADD CONSTRAINT "checklist_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "pneus" ADD CONSTRAINT "pneus_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ordens_coleta_envio" ADD CONSTRAINT "ordens_coleta_envio_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "caminhao_documentos" ADD CONSTRAINT "caminhao_documentos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Swap placa unique: global -> (tenant_id, placa)
ALTER TABLE "caminhoes" DROP CONSTRAINT IF EXISTS "caminhoes_placa_key";
DROP INDEX IF EXISTS "caminhoes_placa_key";

CREATE UNIQUE INDEX IF NOT EXISTS "caminhoes_tenant_id_placa_key" ON "caminhoes"("tenant_id", "placa");

CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "caminhoes_tenant_id_idx" ON "caminhoes"("tenant_id");
CREATE INDEX IF NOT EXISTS "gastos_tenant_id_idx" ON "gastos"("tenant_id");
CREATE INDEX IF NOT EXISTS "checklist_tenant_id_idx" ON "checklist"("tenant_id");
CREATE INDEX IF NOT EXISTS "pneus_tenant_id_idx" ON "pneus"("tenant_id");
CREATE INDEX IF NOT EXISTS "ordens_coleta_envio_tenant_id_idx" ON "ordens_coleta_envio"("tenant_id");
CREATE INDEX IF NOT EXISTS "caminhao_documentos_tenant_id_idx" ON "caminhao_documentos"("tenant_id");
