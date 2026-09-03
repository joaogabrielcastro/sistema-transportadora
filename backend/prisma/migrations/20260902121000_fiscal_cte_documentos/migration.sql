-- infDoc do CT-e: documentos transportados (NF-e por chave, NF modelo 01/1B por
-- número/série, ou "outros"). Relação 1:N com fiscal_ctes. A regra de exigir
-- ao menos 1 documento e a de não misturar nfe/nf no mesmo CT-e são validadas
-- em código no CteService, na emissão nova.
--
-- Tabela NOVA, prefixo fiscal_. NENHUM ALTER em tabela existente.
-- SQL idempotente (CREATE TABLE IF NOT EXISTS + guardas DO $$), estilo ATrack.

CREATE TABLE IF NOT EXISTS "fiscal_cte_documentos" (
    "id"           SERIAL      NOT NULL,
    "tenant_id"    INTEGER     NOT NULL,
    "cte_id"       INTEGER     NOT NULL,
    -- 'nfe' (chave 44) | 'nf' (modelo 01/1B por numero/serie) | 'outros'
    "tipo"         VARCHAR(10) NOT NULL,
    "chave_acesso" VARCHAR(44),
    "numero"       VARCHAR(20),
    "serie"        VARCHAR(10),
    "data_emissao" DATE,
    "valor"        DECIMAL(14, 2),
    "criado_em"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_cte_documentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_cte_documentos_cte_id_idx"
  ON "fiscal_cte_documentos"("cte_id");
CREATE INDEX IF NOT EXISTS "fiscal_cte_documentos_tenant_id_idx"
  ON "fiscal_cte_documentos"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_documentos" ADD CONSTRAINT "fiscal_cte_documentos_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_documentos" ADD CONSTRAINT "fiscal_cte_documentos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
