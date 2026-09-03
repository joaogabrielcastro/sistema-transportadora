-- Tokens de um uso: recuperação de senha e convite de equipe

CREATE TABLE IF NOT EXISTS "auth_tokens" (
  "id" SERIAL PRIMARY KEY,
  "purpose" VARCHAR(32) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "tenant_id" INTEGER,
  "user_id" INTEGER,
  "role" VARCHAR(32),
  "nome" VARCHAR(120),
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_by" INTEGER,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "auth_tokens_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "auth_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "auth_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "auth_tokens_purpose_email_idx" ON "auth_tokens"("purpose", "email");
CREATE INDEX IF NOT EXISTS "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "auth_tokens_tenant_id_idx" ON "auth_tokens"("tenant_id");
