-- infCarga do CT-e: valor da carga, produto predominante, outras características
-- e o grupo infQ (quantidades por unidade de medida, 1:N).
--
-- ALTER apenas em tabela NOSSA (fiscal_ctes) — somente ADD COLUMN nullable.
-- Tabela fiscal_cte_carga_quantidades é NOVA. NENHUM ALTER em tabela existente.
-- SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "valor_carga"            DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "produto_predominante"   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "outras_caracteristicas" VARCHAR(30);

CREATE TABLE IF NOT EXISTS "fiscal_cte_carga_quantidades" (
    "id"             SERIAL      NOT NULL,
    "tenant_id"      INTEGER     NOT NULL,
    "cte_id"         INTEGER     NOT NULL,
    -- cUnid da SEFAZ: 00 = M3, 01 = KG, 02 = TON, 03 = UNIDADE, 04 = LITROS, 05 = MMBTU
    "codigo_unidade" VARCHAR(2),
    "tipo_medida"    VARCHAR(20),
    "quantidade"     DECIMAL(15, 4),
    "criado_em"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_cte_carga_quantidades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_cte_carga_quantidades_cte_id_idx"
  ON "fiscal_cte_carga_quantidades"("cte_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_carga_quantidades" ADD CONSTRAINT "fiscal_cte_carga_quantidades_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_carga_quantidades" ADD CONSTRAINT "fiscal_cte_carga_quantidades_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
