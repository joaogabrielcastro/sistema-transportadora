-- Separa Contrato de Frete (operação de transporte) do registro de CIOT (ANTT).
--
-- Antes, fiscal_ciots misturava os dados da contratação com o identificador
-- devolvido pelo provedor. A operação passa a viver em fiscal_contratos_frete;
-- fiscal_ciots fica só o registro/integração vinculado 1:1 ao contrato.
--
-- Migração segura: copia as linhas existentes (mesmo id), não apaga dados,
-- ALTER só em tabelas NOSSAS. SQL idempotente.

-- ---------------------------------------------------------------------
-- 1. Contrato de Frete / operação de transporte
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_contratos_frete" (
    "id"                            SERIAL       NOT NULL,
    "tenant_id"                     INTEGER      NOT NULL,
    "fiscal_empresa_id"             INTEGER      NOT NULL,
    "caminhao_id"                   INTEGER,
    "motorista_id"                  INTEGER,
    "mdfe_id"                       INTEGER,
    "tipo_operacao"                 SMALLINT,
    "categoria_operacao"            VARCHAR(20),
    "cpf_cnpj_contratado"           VARCHAR(14),
    "rntrc_contratado"              VARCHAR(9),
    "cpf_cnpj_contratante"          VARCHAR(14),
    "rntrc_contratante"             VARCHAR(9),
    "cpf_cnpj_destinatario"         VARCHAR(14),
    "valor_frete"                   DECIMAL(14,2) NOT NULL,
    "valor_piso_minimo_frete"       DECIMAL(14,2),
    "valor_vale_pedagio"            DECIMAL(14,2),
    "data_inicio_viagem"            TIMESTAMPTZ(6),
    "data_fim_viagem"               TIMESTAMPTZ(6),
    "origem_destino"                JSONB,
    "dados_carga"                   JSONB,
    "carga_ncm"                     VARCHAR(8),
    "veiculos"                      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    "inf_pagamento"                 JSONB        NOT NULL DEFAULT '[]'::jsonb,
    "inf_indicadores_operacionais"  JSONB,
    "informacoes_adicionais"        VARCHAR(2000),
    "rntrc_contratado_situacao"     VARCHAR(20),
    "rntrc_contratado_situacao_em"  TIMESTAMPTZ(6),
    "rntrc_contratado_snapshot"     JSONB,
    "retencao_base"                 DECIMAL(14,2),
    "retencao_inss_aliquota"        DECIMAL(7,4),
    "retencao_inss_valor"           DECIMAL(14,2),
    "retencao_sest_senat_aliquota"  DECIMAL(7,4),
    "retencao_sest_senat_valor"     DECIMAL(14,2),
    -- rascunho | ativo | em_andamento | concluido | cancelado
    "status"                        VARCHAR(20)  NOT NULL DEFAULT 'ativo',
    "criado_em"                     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_contratos_frete_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_contratos_frete_tenant_id_idx"
  ON "fiscal_contratos_frete"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiscal_contratos_frete_tenant_id_fiscal_empresa_id_idx"
  ON "fiscal_contratos_frete"("tenant_id", "fiscal_empresa_id");
CREATE INDEX IF NOT EXISTS "fiscal_contratos_frete_tenant_id_status_idx"
  ON "fiscal_contratos_frete"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "fiscal_contratos_frete_mdfe_id_idx"
  ON "fiscal_contratos_frete"("mdfe_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_contratos_frete" ADD CONSTRAINT "fiscal_contratos_frete_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_contratos_frete" ADD CONSTRAINT "fiscal_contratos_frete_fiscal_empresa_id_fkey"
    FOREIGN KEY ("fiscal_empresa_id") REFERENCES "fiscal_empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_contratos_frete" ADD CONSTRAINT "fiscal_contratos_frete_caminhao_id_fkey"
    FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_contratos_frete" ADD CONSTRAINT "fiscal_contratos_frete_motorista_id_fkey"
    FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_contratos_frete" ADD CONSTRAINT "fiscal_contratos_frete_mdfe_id_fkey"
    FOREIGN KEY ("mdfe_id") REFERENCES "fiscal_mdfes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Copia operações já declaradas (mesmo id para compatibilidade de GET /fiscal/ciot/:id).
-- Colunas novas do contrato (partes, origem/destino, dados_carga, piso, vale-pedágio,
-- indicadores, informações adicionais) NÃO existiam em fiscal_ciots: ficam NULL.
-- Não é perda de coluna persistida — esses dados só iam no payload da ANTT.
INSERT INTO "fiscal_contratos_frete" (
    "id",
    "tenant_id",
    "fiscal_empresa_id",
    "caminhao_id",
    "motorista_id",
    "mdfe_id",
    "tipo_operacao",
    "categoria_operacao",
    "valor_frete",
    "data_inicio_viagem",
    "data_fim_viagem",
    "carga_ncm",
    "veiculos",
    "inf_pagamento",
    "rntrc_contratado_situacao",
    "rntrc_contratado_situacao_em",
    "rntrc_contratado_snapshot",
    "retencao_base",
    "retencao_inss_aliquota",
    "retencao_inss_valor",
    "retencao_sest_senat_aliquota",
    "retencao_sest_senat_valor",
    "status",
    "criado_em",
    "atualizado_em"
)
SELECT
    c."id",
    c."tenant_id",
    c."fiscal_empresa_id",
    c."caminhao_id",
    c."motorista_id",
    c."mdfe_id",
    CASE c."categoria_operacao"
      WHEN 'lotacao' THEN 1
      WHEN 'fracionada' THEN 2
      WHEN 'tac_agregado' THEN 3
      ELSE NULL
    END,
    c."categoria_operacao",
    c."valor_frete",
    c."data_inicio_viagem",
    c."data_fim_viagem",
    c."carga_ncm",
    COALESCE(c."veiculos", '[]'::jsonb),
    COALESCE(c."inf_pagamento", '[]'::jsonb),
    c."rntrc_contratado_situacao",
    c."rntrc_contratado_situacao_em",
    c."rntrc_contratado_snapshot",
    c."retencao_base",
    c."retencao_inss_aliquota",
    c."retencao_inss_valor",
    c."retencao_sest_senat_aliquota",
    c."retencao_sest_senat_valor",
    CASE c."status"
      WHEN 'encerrado' THEN 'concluido'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'declarado' THEN 'em_andamento'
      ELSE 'ativo'
    END,
    c."criado_em",
    c."criado_em"
FROM "fiscal_ciots" c
WHERE NOT EXISTS (
    SELECT 1 FROM "fiscal_contratos_frete" x WHERE x."id" = c."id"
);

SELECT setval(
  pg_get_serial_sequence('fiscal_contratos_frete', 'id'),
  COALESCE((SELECT MAX(id) FROM "fiscal_contratos_frete"), 1),
  (SELECT EXISTS (SELECT 1 FROM "fiscal_contratos_frete"))
);

-- ---------------------------------------------------------------------
-- 2. CIOT: colunas de integração + vínculo com o contrato
-- ---------------------------------------------------------------------
ALTER TABLE "fiscal_ciots"
  ADD COLUMN IF NOT EXISTS "contrato_frete_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(32) NOT NULL DEFAULT 'antt',
  ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "registered_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "response_data" JSONB,
  ADD COLUMN IF NOT EXISTS "error_code" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "fiscal_ciots"
SET
  "contrato_frete_id" = "id",
  "registered_at" = COALESCE("registered_at", "data_declaracao"),
  "status" = CASE "status"
    WHEN 'declarado' THEN 'registrado'
    WHEN 'pendente' THEN 'registrando'
    ELSE "status"
  END
WHERE "contrato_frete_id" IS NULL;

-- 1:1 obrigatório. Se alguma linha de CIOT não tiver contrato, a migration
-- deve falhar — não engolir o erro.
ALTER TABLE "fiscal_ciots" ALTER COLUMN "contrato_frete_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ciots_contrato_frete_id_key"
  ON "fiscal_ciots"("contrato_frete_id");
CREATE INDEX IF NOT EXISTS "fiscal_ciots_tenant_id_contrato_frete_id_idx"
  ON "fiscal_ciots"("tenant_id", "contrato_frete_id");
CREATE INDEX IF NOT EXISTS "fiscal_ciots_tenant_id_codigo_idx"
  ON "fiscal_ciots"("tenant_id", "codigo_identificacao_operacao");

DO $$ BEGIN
  ALTER TABLE "fiscal_ciots" ADD CONSTRAINT "fiscal_ciots_contrato_frete_id_fkey"
    FOREIGN KEY ("contrato_frete_id") REFERENCES "fiscal_contratos_frete"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Remove FKs das colunas que passam a viver só no contrato.
ALTER TABLE "fiscal_ciots" DROP CONSTRAINT IF EXISTS "fiscal_ciots_fiscal_empresa_id_fkey";
ALTER TABLE "fiscal_ciots" DROP CONSTRAINT IF EXISTS "fiscal_ciots_caminhao_id_fkey";
ALTER TABLE "fiscal_ciots" DROP CONSTRAINT IF EXISTS "fiscal_ciots_motorista_id_fkey";
ALTER TABLE "fiscal_ciots" DROP CONSTRAINT IF EXISTS "fiscal_ciots_mdfe_id_fkey";

DROP INDEX IF EXISTS "fiscal_ciots_tenant_id_fiscal_empresa_id_idx";
DROP INDEX IF EXISTS "fiscal_ciots_mdfe_id_idx";

ALTER TABLE "fiscal_ciots"
  DROP COLUMN IF EXISTS "fiscal_empresa_id",
  DROP COLUMN IF EXISTS "caminhao_id",
  DROP COLUMN IF EXISTS "motorista_id",
  DROP COLUMN IF EXISTS "mdfe_id",
  DROP COLUMN IF EXISTS "carga_ncm",
  DROP COLUMN IF EXISTS "rntrc_contratado_situacao",
  DROP COLUMN IF EXISTS "rntrc_contratado_situacao_em",
  DROP COLUMN IF EXISTS "rntrc_contratado_snapshot",
  DROP COLUMN IF EXISTS "categoria_operacao",
  DROP COLUMN IF EXISTS "valor_frete",
  DROP COLUMN IF EXISTS "data_declaracao",
  DROP COLUMN IF EXISTS "data_inicio_viagem",
  DROP COLUMN IF EXISTS "data_fim_viagem",
  DROP COLUMN IF EXISTS "veiculos",
  DROP COLUMN IF EXISTS "inf_pagamento",
  DROP COLUMN IF EXISTS "retencao_base",
  DROP COLUMN IF EXISTS "retencao_inss_aliquota",
  DROP COLUMN IF EXISTS "retencao_inss_valor",
  DROP COLUMN IF EXISTS "retencao_sest_senat_aliquota",
  DROP COLUMN IF EXISTS "retencao_sest_senat_valor";

-- ---------------------------------------------------------------------
-- 3. CT-e / MDF-e passam a referenciar o contrato (CIOT sai da operação)
-- ---------------------------------------------------------------------
ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "contrato_frete_id" INTEGER;

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "contrato_frete_id" INTEGER;

CREATE INDEX IF NOT EXISTS "fiscal_ctes_contrato_frete_id_idx"
  ON "fiscal_ctes"("contrato_frete_id");
CREATE INDEX IF NOT EXISTS "fiscal_mdfes_contrato_frete_id_idx"
  ON "fiscal_mdfes"("contrato_frete_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_contrato_frete_id_fkey"
    FOREIGN KEY ("contrato_frete_id") REFERENCES "fiscal_contratos_frete"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_contrato_frete_id_fkey"
    FOREIGN KEY ("contrato_frete_id") REFERENCES "fiscal_contratos_frete"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Religa CT-e/MDF-e já emitidos cujo número de CIOT bate com um registro deste
-- tenant. Não cria contrato nem CIOT; só preenche a FK.
UPDATE "fiscal_ctes" cte
SET "contrato_frete_id" = ciot."contrato_frete_id"
FROM "fiscal_ciots" ciot
WHERE cte."contrato_frete_id" IS NULL
  AND cte."tenant_id" = ciot."tenant_id"
  AND ciot."codigo_identificacao_operacao" IS NOT NULL
  AND regexp_replace(COALESCE(cte."antt_ciot", ''), '\D', '', 'g') <> ''
  AND regexp_replace(cte."antt_ciot", '\D', '', 'g')
      = regexp_replace(ciot."codigo_identificacao_operacao", '\D', '', 'g');

UPDATE "fiscal_mdfes" mdfe
SET "contrato_frete_id" = ciot."contrato_frete_id"
FROM "fiscal_ciots" ciot
WHERE mdfe."contrato_frete_id" IS NULL
  AND mdfe."tenant_id" = ciot."tenant_id"
  AND ciot."codigo_identificacao_operacao" IS NOT NULL
  AND regexp_replace(COALESCE(mdfe."antt_ciot", ''), '\D', '', 'g') <> ''
  AND regexp_replace(mdfe."antt_ciot", '\D', '', 'g')
      = regexp_replace(ciot."codigo_identificacao_operacao", '\D', '', 'g');
