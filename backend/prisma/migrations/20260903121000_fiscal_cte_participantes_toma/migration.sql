-- CT-e: modelagem separada de remetente / destinatário / expedidor / recebedor
-- (grupos rem / dest / exped / receb da SEFAZ), cada um com endereço completo,
-- + indicador `toma` (ide.toma: qual desses papéis é o tomador do serviço, ou
-- 4 = outros, caso em que os dados vão no campo livre `tomador`). Hoje o CT-e
-- só tem cliente_id genérico.
--
-- Tabela fiscal_cte_participantes é NOVA. O ALTER é só em fiscal_ctes (tabela
-- NOSSA) e apenas ADD COLUMN nullable. NENHUM ALTER em tabela existente.
-- SQL idempotente, estilo ATrack. Emissões antigas: toma NULL, sem
-- participantes — comportamento inalterado.

ALTER TABLE "fiscal_ctes"
  -- ide.toma: 0 = remetente, 1 = expedidor, 2 = recebedor, 3 = destinatário,
  -- 4 = outros (dados do tomador no campo livre `tomador`)
  ADD COLUMN IF NOT EXISTS "toma" SMALLINT;

CREATE TABLE IF NOT EXISTS "fiscal_cte_participantes" (
    "id"               SERIAL       NOT NULL,
    "tenant_id"        INTEGER      NOT NULL,
    "cte_id"           INTEGER      NOT NULL,
    -- 'rem' | 'dest' | 'exped' | 'receb'
    "papel"            VARCHAR(6)   NOT NULL,
    "cnpj_cpf"         VARCHAR(14),
    "ie"               VARCHAR(20),
    "razao_social"     VARCHAR(255),
    "nome_fantasia"    VARCHAR(255),
    "fone"             VARCHAR(20),
    "email"            VARCHAR(120),
    "logradouro"       VARCHAR(255),
    "numero"           VARCHAR(60),
    "complemento"      VARCHAR(255),
    "bairro"           VARCHAR(120),
    "codigo_municipio" VARCHAR(7),
    "nome_municipio"   VARCHAR(120),
    "uf"               VARCHAR(2),
    "cep"              VARCHAR(8),
    "codigo_pais"      VARCHAR(4),
    "nome_pais"        VARCHAR(60),
    "criado_em"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_cte_participantes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_cte_participantes_cte_id_papel_key"
  ON "fiscal_cte_participantes"("cte_id", "papel");
CREATE INDEX IF NOT EXISTS "fiscal_cte_participantes_cte_id_idx"
  ON "fiscal_cte_participantes"("cte_id");
CREATE INDEX IF NOT EXISTS "fiscal_cte_participantes_tenant_id_idx"
  ON "fiscal_cte_participantes"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_participantes" ADD CONSTRAINT "fiscal_cte_participantes_cte_id_fkey"
    FOREIGN KEY ("cte_id") REFERENCES "fiscal_ctes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_cte_participantes" ADD CONSTRAINT "fiscal_cte_participantes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
