-- Brasil NFe: rascunhos (chave nullable), snapshot de ambiente/SEFAZ, UserToken
-- por empresa e lock de emissão.

ALTER TABLE "fiscal_empresas"
  ADD COLUMN IF NOT EXISTS "brasil_nfe_user_token" TEXT;

ALTER TABLE "fiscal_ctes"
  ALTER COLUMN "chave_acesso" DROP NOT NULL;

ALTER TABLE "fiscal_ctes"
  ALTER COLUMN "status" SET DEFAULT 'rascunho';

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "payload_json" JSONB,
  ADD COLUMN IF NOT EXISTS "ambiente" SMALLINT,
  ADD COLUMN IF NOT EXISTS "autorizado_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelado_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelado_justificativa" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "cancelado_protocolo" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "sefaz_codigo" INTEGER,
  ADD COLUMN IF NOT EXISTS "sefaz_mensagem" TEXT,
  ADD COLUMN IF NOT EXISTS "sefaz_detalhes" JSONB,
  ADD COLUMN IF NOT EXISTS "sefaz_operacao" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "sefaz_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "brasil_nfe_id" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "emissao_iniciada_em" TIMESTAMPTZ(6);

ALTER TABLE "fiscal_mdfes"
  ALTER COLUMN "chave_acesso" DROP NOT NULL;

ALTER TABLE "fiscal_mdfes"
  ALTER COLUMN "status" SET DEFAULT 'rascunho';

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "payload_json" JSONB,
  ADD COLUMN IF NOT EXISTS "ambiente" SMALLINT,
  ADD COLUMN IF NOT EXISTS "autorizado_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "sefaz_codigo" INTEGER,
  ADD COLUMN IF NOT EXISTS "sefaz_mensagem" TEXT,
  ADD COLUMN IF NOT EXISTS "sefaz_detalhes" JSONB,
  ADD COLUMN IF NOT EXISTS "sefaz_operacao" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "sefaz_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "brasil_nfe_id" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "emissao_iniciada_em" TIMESTAMPTZ(6);
