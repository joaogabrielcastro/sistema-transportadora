-- Generaliza o acoplamento a fornecedor no módulo fiscal de transporte e
-- resolve o multi-CNPJ em CT-e / MDF-e.
--
-- ALTERs apenas em tabelas NOSSAS (fiscal_*), criadas em
-- 20260827200000_fiscal_transporte e ainda sem dado real. NENHUM ALTER em
-- caminhoes / motoristas / tenants / users.
-- SQL idempotente (guardas information_schema / DO $$), estilo ATrack.

-- ---------------------------------------------------------------------
-- 1. fiscal_empresas.brasil_nfe_token -> cte_mdfe_provider_token
--    (provedor de CT-e/MDF-e ainda não decidido; nome sem fornecedor)
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fiscal_empresas'
          AND column_name = 'brasil_nfe_token'
      )
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fiscal_empresas'
          AND column_name = 'cte_mdfe_provider_token'
      )
  THEN
    ALTER TABLE "fiscal_empresas"
      RENAME COLUMN "brasil_nfe_token" TO "cte_mdfe_provider_token";
  END IF;
END $$;

-- Cobre bancos onde a tabela foi criada já sem a coluna antiga.
ALTER TABLE "fiscal_empresas"
  ADD COLUMN IF NOT EXISTS "cte_mdfe_provider_token" TEXT;

-- ---------------------------------------------------------------------
-- 2. fiscal_ctes.fiscal_empresa_id (opcional): CNPJ emissor resolvido na
--    emissão. Antes, o cancelamento assumia "a única empresa fiscal ativa"
--    do tenant — quebra com mais de um CNPJ ativo.
-- ---------------------------------------------------------------------
ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "fiscal_empresa_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_fiscal_empresa_id_fkey"
    FOREIGN KEY ("fiscal_empresa_id") REFERENCES "fiscal_empresas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "fiscal_ctes_tenant_id_fiscal_empresa_id_idx"
  ON "fiscal_ctes"("tenant_id", "fiscal_empresa_id");

-- ---------------------------------------------------------------------
-- 3. fiscal_mdfes.fiscal_empresa_id (opcional): mesmo motivo do CT-e.
-- ---------------------------------------------------------------------
ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "fiscal_empresa_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_fiscal_empresa_id_fkey"
    FOREIGN KEY ("fiscal_empresa_id") REFERENCES "fiscal_empresas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "fiscal_mdfes_tenant_id_fiscal_empresa_id_idx"
  ON "fiscal_mdfes"("tenant_id", "fiscal_empresa_id");
