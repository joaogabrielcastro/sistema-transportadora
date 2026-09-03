-- MDF-e: grupo infMunDescarga (município de descarregamento) — item 2.1. Cada
-- CT-e / NF-e vinculado ao manifesto pertence a um município de descarga
-- específico (necessário para múltiplas paradas). Hoje só existe a lista plana
-- de chaves vinculadas, sem município.
--
-- Tabela NOVA, prefixo fiscal_. NENHUM ALTER em tabela existente.
-- SQL idempotente, estilo ATrack. MDF-e antigos: sem linhas aqui, o payload
-- continua usando a lista plana de documentos vinculados.

CREATE TABLE IF NOT EXISTS "fiscal_mdfe_documentos_descarga" (
    "id"               SERIAL      NOT NULL,
    "tenant_id"        INTEGER     NOT NULL,
    "mdfe_id"          INTEGER     NOT NULL,
    "codigo_municipio" VARCHAR(7),
    "nome_municipio"   VARCHAR(120),
    -- 'cte' | 'nfe' | 'mdfe'
    "tipo"             VARCHAR(5),
    "chave_acesso"     VARCHAR(44),
    "criado_em"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_mdfe_documentos_descarga_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_mdfe_documentos_descarga_mdfe_id_idx"
  ON "fiscal_mdfe_documentos_descarga"("mdfe_id");
CREATE INDEX IF NOT EXISTS "fiscal_mdfe_documentos_descarga_mdfe_id_codigo_municipio_idx"
  ON "fiscal_mdfe_documentos_descarga"("mdfe_id", "codigo_municipio");
CREATE INDEX IF NOT EXISTS "fiscal_mdfe_documentos_descarga_tenant_id_idx"
  ON "fiscal_mdfe_documentos_descarga"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_documentos_descarga" ADD CONSTRAINT "fiscal_mdfe_documentos_descarga_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_documentos_descarga" ADD CONSTRAINT "fiscal_mdfe_documentos_descarga_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
