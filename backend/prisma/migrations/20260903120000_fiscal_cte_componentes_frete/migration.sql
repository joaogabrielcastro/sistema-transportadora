-- vPrest.Comp do CT-e: componentes do valor da prestação do serviço (FRETE
-- PESO, FRETE VALOR, SEC/CAT, GRIS, PEDAGIO, AD VALOREM, OUTROS, ...). Relação
-- 1:N com fiscal_ctes. Hoje só existe o total em fiscal_ctes.valor_frete; esta
-- tabela guarda a composição, sem tocar no total.
--
-- Tabela NOVA, prefixo fiscal_. NENHUM ALTER em tabela existente.
-- SQL idempotente (CREATE TABLE IF NOT EXISTS + guardas DO $$), estilo ATrack.
-- Nenhuma obrigatoriedade nova: a soma dos componentes NÃO é conferida contra
-- valor_prestacao (passthrough+persistência); uma inconsistência é rejeitada
-- pelo provedor, não por nós.

CREATE TABLE IF NOT EXISTS "fiscal_cte_componentes_frete" (
    "id"        SERIAL      NOT NULL,
    "tenant_id" INTEGER     NOT NULL,
    "cte_id"    INTEGER     NOT NULL,
    -- xNome do Comp (SEFAZ): descrição livre do componente
    "nome"      VARCHAR(60) NOT NULL,
    "valor"     DECIMAL(14, 2),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_cte_componentes_frete_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_cte_componentes_frete_cte_id_idx"
  ON "fiscal_cte_componentes_frete"("cte_id");
CREATE INDEX IF NOT EXISTS "fiscal_cte_componentes_frete_tenant_id_idx"
  ON "fiscal_cte_componentes_frete"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_componentes_frete" ADD CONSTRAINT "fiscal_cte_componentes_frete_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_componentes_frete" ADD CONSTRAINT "fiscal_cte_componentes_frete_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
