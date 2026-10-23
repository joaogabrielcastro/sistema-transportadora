-- Versão de sessão: incrementada ao mudar senha; JWTs com sv antigo são rejeitados.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
