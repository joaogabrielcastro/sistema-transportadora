-- Módulo fiscal de transporte (CT-e / MDF-e / CIOT).
-- Tabelas novas, prefixo fiscal_, isoladas das tabelas existentes.
-- SQL idempotente (CREATE TABLE IF NOT EXISTS + guardas DO $$), estilo ATrack.
-- NENHUM ALTER em caminhoes / motoristas / tenants / users.

-- ---------------------------------------------------------------------
-- fiscal_empresas: dados por CNPJ para emitir (token/certificado cifrados)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_empresas" (
    "id"                     SERIAL       NOT NULL,
    "tenant_id"              INTEGER      NOT NULL,
    "cnpj"                   VARCHAR(18)  NOT NULL,
    "razao_social"           VARCHAR(255) NOT NULL,
    "rntrc"                  VARCHAR(9),
    "brasil_nfe_token"       TEXT,
    "certificado_pfx_path"   VARCHAR(500),
    "certificado_senha"      TEXT,
    "certificado_valido_ate" DATE,
    "ativo"                  BOOLEAN      NOT NULL DEFAULT true,
    "criado_em"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_empresas_tenant_id_cnpj_key"
  ON "fiscal_empresas"("tenant_id", "cnpj");
CREATE INDEX IF NOT EXISTS "fiscal_empresas_tenant_id_idx"
  ON "fiscal_empresas"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_empresas" ADD CONSTRAINT "fiscal_empresas_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- fiscal_veiculo_dados: extensão fiscal de um caminhão (sem tocar caminhoes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_veiculo_dados" (
    "id"            SERIAL      NOT NULL,
    "caminhao_id"   INTEGER     NOT NULL,
    "rntrc_veiculo" VARCHAR(9),
    "criado_em"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_veiculo_dados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_veiculo_dados_caminhao_id_key"
  ON "fiscal_veiculo_dados"("caminhao_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_veiculo_dados" ADD CONSTRAINT "fiscal_veiculo_dados_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- fiscal_clientes: tomador do frete (cnpj_cpf normalizado só dígitos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_clientes" (
    "id"           SERIAL       NOT NULL,
    "tenant_id"    INTEGER      NOT NULL,
    "razao_social" VARCHAR(255) NOT NULL,
    "cnpj_cpf"     VARCHAR(14)  NOT NULL,
    "criado_em"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_clientes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_clientes_tenant_id_cnpj_cpf_key"
  ON "fiscal_clientes"("tenant_id", "cnpj_cpf");
CREATE INDEX IF NOT EXISTS "fiscal_clientes_tenant_id_idx"
  ON "fiscal_clientes"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_clientes" ADD CONSTRAINT "fiscal_clientes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- fiscal_mdfes: manifesto (criado antes de fiscal_ctes p/ FK manifesto_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_mdfes" (
    "id"               SERIAL      NOT NULL,
    "tenant_id"        INTEGER     NOT NULL,
    "caminhao_id"      INTEGER,
    "motorista_id"     INTEGER,
    "chave_acesso"     VARCHAR(44) NOT NULL,
    "numero"           VARCHAR(20),
    "serie"            VARCHAR(10),
    "numero_protocolo" VARCHAR(30),
    "status"           VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "data_emissao"     TIMESTAMPTZ(6),
    "xml_path"         VARCHAR(500),
    "criado_em"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_mdfes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_mdfes_chave_acesso_key"
  ON "fiscal_mdfes"("chave_acesso");
CREATE INDEX IF NOT EXISTS "fiscal_mdfes_tenant_id_idx"
  ON "fiscal_mdfes"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- fiscal_ctes: conhecimento de transporte
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_ctes" (
    "id"           SERIAL      NOT NULL,
    "tenant_id"    INTEGER     NOT NULL,
    "cliente_id"   INTEGER     NOT NULL,
    "caminhao_id"  INTEGER,
    "motorista_id" INTEGER,
    "manifesto_id" INTEGER,
    "chave_acesso" VARCHAR(44) NOT NULL,
    "status"       VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "numero"       VARCHAR(20),
    "serie"        VARCHAR(10),
    "data_emissao" TIMESTAMPTZ(6),
    "valor_frete"  DECIMAL(14,2),
    "xml_path"     VARCHAR(500),
    "criado_em"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_ctes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ctes_chave_acesso_key"
  ON "fiscal_ctes"("chave_acesso");
CREATE INDEX IF NOT EXISTS "fiscal_ctes_tenant_id_idx"
  ON "fiscal_ctes"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiscal_ctes_tenant_id_cliente_id_idx"
  ON "fiscal_ctes"("tenant_id", "cliente_id");
CREATE INDEX IF NOT EXISTS "fiscal_ctes_manifesto_id_idx"
  ON "fiscal_ctes"("manifesto_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "fiscal_clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_manifesto_id_fkey"
    FOREIGN KEY ("manifesto_id") REFERENCES "fiscal_mdfes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- fiscal_ciots: operação de transporte declarada na ANTT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_ciots" (
    "id"                            SERIAL      NOT NULL,
    "tenant_id"                     INTEGER     NOT NULL,
    "fiscal_empresa_id"             INTEGER     NOT NULL,
    "caminhao_id"                   INTEGER,
    "motorista_id"                  INTEGER,
    "id_operacao_transporte"        VARCHAR(12) NOT NULL,
    "codigo_identificacao_operacao" VARCHAR(20),
    "codigo_verificador"            VARCHAR(20),
    "protocolo"                     VARCHAR(40),
    "status"                        VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "valor_frete"                   DECIMAL(14,2) NOT NULL,
    "data_declaracao"               TIMESTAMPTZ(6) NOT NULL,
    "data_inicio_viagem"            TIMESTAMPTZ(6) NOT NULL,
    "data_fim_viagem"               TIMESTAMPTZ(6) NOT NULL,
    "veiculos"                      JSONB       NOT NULL,
    "inf_pagamento"                 JSONB       NOT NULL,
    "criado_em"                     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_ciots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ciots_id_operacao_transporte_key"
  ON "fiscal_ciots"("id_operacao_transporte");
CREATE INDEX IF NOT EXISTS "fiscal_ciots_tenant_id_idx"
  ON "fiscal_ciots"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiscal_ciots_tenant_id_fiscal_empresa_id_idx"
  ON "fiscal_ciots"("tenant_id", "fiscal_empresa_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_fiscal_empresa_id_fkey"
    FOREIGN KEY ("fiscal_empresa_id") REFERENCES "fiscal_empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
