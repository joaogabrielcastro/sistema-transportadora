-- MDF-e: seguro da carga como LISTA (item 0.2). CONFIRMADO com o payload real do
-- provedor: `seguros: [...]`, cada seguro com `numerosAverbacao` também em array
-- (múltiplas averbações por seguro). Hoje fiscal_mdfes tem só colunas singulares
-- (seg_responsavel, seg_cnpj_seguradora, ...). Essas colunas NÃO são removidas —
-- documentos já emitidos dependem delas e elas seguem funcionando como fallback
-- de 1 seguro. Esta tabela NOVA (1:N) suporta múltiplos seguros daqui pra
-- frente; `numeros_averbacao` é um array JSONB de strings (0..N averbações).
--
-- Tabela NOVA, prefixo fiscal_. NENHUM ALTER em tabela existente. SQL
-- idempotente, estilo ATrack. MDF-e antigos: sem linhas aqui, o payload segue
-- montando o seguro a partir das colunas singulares.

CREATE TABLE IF NOT EXISTS "fiscal_mdfe_seguros" (
    "id"                SERIAL      NOT NULL,
    "tenant_id"         INTEGER     NOT NULL,
    "mdfe_id"           INTEGER     NOT NULL,
    -- indicadorResponsavel: 1 = emitente do MDF-e, 2 = contratante do serviço
    "responsavel"       SMALLINT,
    "cnpj_seguradora"   VARCHAR(14),
    "numero_apolice"    VARCHAR(40),
    "nome_seguradora"   VARCHAR(60),
    -- numerosAverbacao do provedor: array de strings (múltiplas averbações)
    "numeros_averbacao" JSONB,
    "criado_em"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_mdfe_seguros_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_mdfe_seguros_mdfe_id_idx"
  ON "fiscal_mdfe_seguros"("mdfe_id");
CREATE INDEX IF NOT EXISTS "fiscal_mdfe_seguros_tenant_id_idx"
  ON "fiscal_mdfe_seguros"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_seguros" ADD CONSTRAINT "fiscal_mdfe_seguros_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_seguros" ADD CONSTRAINT "fiscal_mdfe_seguros_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
