-- MDF-e: grupos seg (2.1), infANTT (2.2), tot (2.3), prodPred (2.4) e campos
-- básicos de ide (2.5) + tabela de municípios de carregamento.
--
-- ALTER apenas em tabela NOSSA (fiscal_mdfes, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN, todas nullable.
-- Tabela fiscal_mdfe_municipios_carrega é NOVA. NENHUM ALTER em tabela
-- existente. As obrigatoriedades novas (seguro_responsavel; infANTT/prodPred
-- quando não é frota própria) são validadas em código no MdfeService, só na
-- emissão nova — MDF-e já emitidos não são afetados.
-- SQL idempotente, estilo ATrack.

ALTER TABLE "fiscal_mdfes"
  -- seg (2.1): responsável 1 = emitente do MDF-e, 2 = contratante do serviço
  ADD COLUMN IF NOT EXISTS "seg_responsavel"      SMALLINT,
  ADD COLUMN IF NOT EXISTS "seg_cnpj_seguradora"  VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "seg_numero_apolice"   VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "seg_numero_averbacao" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "seg_nome_seguradora"  VARCHAR(60),
  -- infANTT (2.2): RNTRC do transportador, CIOT e grupo valePedagio (livre)
  ADD COLUMN IF NOT EXISTS "antt_rntrc"           VARCHAR(9),
  ADD COLUMN IF NOT EXISTS "antt_ciot"            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "antt_vale_pedagio"    JSONB,
  -- tot (2.3): calculado a partir dos CT-e/NF-e vinculados na emissão
  ADD COLUMN IF NOT EXISTS "tot_qcte"             INTEGER,
  ADD COLUMN IF NOT EXISTS "tot_valor_carga"      DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "tot_peso_bruto"       DECIMAL(14, 3),
  -- prodPred (2.4)
  ADD COLUMN IF NOT EXISTS "prod_pred_descricao"  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "prod_pred_ncm"        VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "prod_pred_tp_carga"   VARCHAR(2),
  -- ide (2.5): campos básicos do grupo de identificação
  ADD COLUMN IF NOT EXISTS "ide_uf_ini"           VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "ide_uf_fim"           VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "ide_dh_ini_viagem"    TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "ide_tp_transp"        SMALLINT,
  ADD COLUMN IF NOT EXISTS "ide_modal"            SMALLINT;

CREATE TABLE IF NOT EXISTS "fiscal_mdfe_municipios_carrega" (
    "id"               SERIAL      NOT NULL,
    "tenant_id"        INTEGER     NOT NULL,
    "mdfe_id"          INTEGER     NOT NULL,
    "codigo_municipio" VARCHAR(7),
    "nome_municipio"   VARCHAR(120),
    "criado_em"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_mdfe_municipios_carrega_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_mdfe_municipios_carrega_mdfe_id_idx"
  ON "fiscal_mdfe_municipios_carrega"("mdfe_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_municipios_carrega" ADD CONSTRAINT "fiscal_mdfe_municipios_carrega_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfe_municipios_carrega" ADD CONSTRAINT "fiscal_mdfe_municipios_carrega_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
