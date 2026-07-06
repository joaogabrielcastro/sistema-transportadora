-- CreateTable users + retry_count em ordens_coleta_envio
ALTER TABLE "ordens_coleta_envio" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'operator',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
