-- Aceite de termos e privacidade (cadastro público e convite)

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "legal_version" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "legal_accepted_at" TIMESTAMPTZ(6);

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "legal_version" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "legal_accepted_at" TIMESTAMPTZ(6);
