-- autXML do CT-e (item 1.1): CNPJ/CPF de terceiros autorizados a baixar o XML
-- do CT-e. Relação 1:N com fiscal_ctes. Puramente opcional — NENHUMA regra de
-- obrigatoriedade em código (o grupo pode ter 0 linhas). Não bloqueia emissão.
--
-- Tabela NOVA, prefixo fiscal_. NENHUM ALTER em tabela existente.
-- SQL idempotente (CREATE TABLE IF NOT EXISTS + guardas DO $$), estilo ATrack.

CREATE TABLE IF NOT EXISTS "fiscal_cte_aut_xml" (
    "id"        SERIAL      NOT NULL,
    "tenant_id" INTEGER     NOT NULL,
    "cte_id"    INTEGER     NOT NULL,
    -- CNPJ (14) ou CPF (11) só-dígitos; nullable por precaução (regra do módulo:
    -- toda coluna nova é opcional).
    "cnpj_cpf"  VARCHAR(14),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_cte_aut_xml_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_cte_aut_xml_cte_id_idx"
  ON "fiscal_cte_aut_xml"("cte_id");
CREATE INDEX IF NOT EXISTS "fiscal_cte_aut_xml_tenant_id_idx"
  ON "fiscal_cte_aut_xml"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_aut_xml" ADD CONSTRAINT "fiscal_cte_aut_xml_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_aut_xml" ADD CONSTRAINT "fiscal_cte_aut_xml_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
