-- Tenant feature flags
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '{}';

-- Vehicle type fields
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "tipo_veiculo" VARCHAR(20) NOT NULL DEFAULT 'truck';
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "config_eixos" VARCHAR(32);
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "com_4_eixo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "chassi" VARCHAR(40);
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "empresa" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "caminhoes_tenant_id_tipo_veiculo_idx" ON "caminhoes"("tenant_id", "tipo_veiculo");

-- Infer cavalo when numero_cavalo is set
UPDATE "caminhoes"
SET "tipo_veiculo" = 'cavalo'
WHERE "numero_cavalo" IS NOT NULL AND "tipo_veiculo" = 'truck';

-- Composition links
CREATE TABLE IF NOT EXISTS "vinculos_composicao" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cavalo_id" INTEGER NOT NULL,
    "carreta_id" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "inicio_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim_em" TIMESTAMPTZ(6),

    CONSTRAINT "vinculos_composicao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vinculos_composicao_tenant_id_idx" ON "vinculos_composicao"("tenant_id");
CREATE INDEX IF NOT EXISTS "vinculos_composicao_cavalo_id_ativo_idx" ON "vinculos_composicao"("cavalo_id", "ativo");
CREATE INDEX IF NOT EXISTS "vinculos_composicao_carreta_id_ativo_idx" ON "vinculos_composicao"("carreta_id", "ativo");

-- Partial unique: one active link per carreta per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "vinculos_composicao_tenant_carreta_ativo_key"
  ON "vinculos_composicao"("tenant_id", "carreta_id")
  WHERE "ativo" = true;

ALTER TABLE "vinculos_composicao" DROP CONSTRAINT IF EXISTS "vinculos_composicao_tenant_id_fkey";
ALTER TABLE "vinculos_composicao" ADD CONSTRAINT "vinculos_composicao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "vinculos_composicao" DROP CONSTRAINT IF EXISTS "vinculos_composicao_cavalo_id_fkey";
ALTER TABLE "vinculos_composicao" ADD CONSTRAINT "vinculos_composicao_cavalo_id_fkey"
  FOREIGN KEY ("cavalo_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "vinculos_composicao" DROP CONSTRAINT IF EXISTS "vinculos_composicao_carreta_id_fkey";
ALTER TABLE "vinculos_composicao" ADD CONSTRAINT "vinculos_composicao_carreta_id_fkey"
  FOREIGN KEY ("carreta_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Migrate legacy placa_carreta_* into separate carreta records + vinculos
DO $$
DECLARE
  r RECORD;
  carreta_id INT;
  carreta_placa TEXT;
  slot INT;
BEGIN
  FOR r IN
    SELECT * FROM "caminhoes"
    WHERE (placa_carreta_1 IS NOT NULL AND TRIM(placa_carreta_1) <> '')
       OR (placa_carreta_2 IS NOT NULL AND TRIM(placa_carreta_2) <> '')
  LOOP
    -- ensure parent is cavalo when it had trailers
    UPDATE "caminhoes" SET "tipo_veiculo" = 'cavalo' WHERE id = r.id AND tipo_veiculo = 'truck';

    FOR slot IN 1..2 LOOP
      carreta_placa := CASE WHEN slot = 1 THEN NULLIF(TRIM(r.placa_carreta_1), '') ELSE NULLIF(TRIM(r.placa_carreta_2), '') END;
      IF carreta_placa IS NULL THEN
        CONTINUE;
      END IF;

      SELECT id INTO carreta_id
      FROM "caminhoes"
      WHERE tenant_id = r.tenant_id AND UPPER(REPLACE(placa, '-', '')) = UPPER(REPLACE(carreta_placa, '-', ''))
      LIMIT 1;

      IF carreta_id IS NULL THEN
        INSERT INTO "caminhoes" (
          tenant_id, placa, qtd_pneus, km_atual, tipo_veiculo, marca, modelo, empresa
        ) VALUES (
          r.tenant_id,
          UPPER(REPLACE(carreta_placa, '-', '')),
          12,
          0,
          'carreta',
          r.marca,
          COALESCE(r.modelo, 'Carreta'),
          r.empresa
        )
        RETURNING id INTO carreta_id;
      ELSE
        UPDATE "caminhoes" SET tipo_veiculo = 'carreta' WHERE id = carreta_id;
      END IF;

      INSERT INTO "vinculos_composicao" (tenant_id, cavalo_id, carreta_id, ordem, ativo)
      SELECT r.tenant_id, r.id, carreta_id, slot, true
      WHERE NOT EXISTS (
        SELECT 1 FROM "vinculos_composicao" v
        WHERE v.tenant_id = r.tenant_id AND v.carreta_id = carreta_id AND v.ativo = true
      );
    END LOOP;

    UPDATE "caminhoes"
    SET placa_carreta_1 = NULL, placa_carreta_2 = NULL,
        numero_carreta_1 = NULL, numero_carreta_2 = NULL
    WHERE id = r.id;
  END LOOP;
END $$;

-- Feature defaults by slug
UPDATE "tenants"
SET "features" = '{"ordem_coleta":true,"notas_estoque":false}'::jsonb
WHERE COALESCE("features", '{}'::jsonb) = '{}'::jsonb
  AND "slug" <> 'trans-motin';

UPDATE "tenants"
SET "features" = '{"ordem_coleta":false,"notas_estoque":true}'::jsonb
WHERE "slug" = 'trans-motin';

-- Products / NF-e / stock (Motin feature; tables shared, gated by features)
CREATE TABLE IF NOT EXISTS "produtos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "codigo" VARCHAR(60),
    "descricao" VARCHAR(500) NOT NULL,
    "unidade" VARCHAR(20) NOT NULL DEFAULT 'UN',
    "ncm" VARCHAR(20),
    "saldo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "produtos_tenant_id_idx" ON "produtos"("tenant_id");
CREATE INDEX IF NOT EXISTS "produtos_tenant_id_codigo_idx" ON "produtos"("tenant_id", "codigo");
CREATE INDEX IF NOT EXISTS "produtos_tenant_id_descricao_idx" ON "produtos"("tenant_id", "descricao");

ALTER TABLE "produtos" DROP CONSTRAINT IF EXISTS "produtos_tenant_id_fkey";
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "notas_fiscais" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "chave_acesso" VARCHAR(44),
    "numero" VARCHAR(20) NOT NULL,
    "serie" VARCHAR(10),
    "emitente" VARCHAR(255),
    "cnpj_emitente" VARCHAR(18),
    "data_emissao" DATE,
    "valor_total" DECIMAL(14,2),
    "pdf_path" VARCHAR(500),
    "xml_path" VARCHAR(500),
    "status" VARCHAR(32) NOT NULL DEFAULT 'confirmada',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_tenant_id_chave_acesso_key"
  ON "notas_fiscais"("tenant_id", "chave_acesso")
  WHERE "chave_acesso" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "notas_fiscais_tenant_id_idx" ON "notas_fiscais"("tenant_id");
CREATE INDEX IF NOT EXISTS "notas_fiscais_tenant_id_numero_idx" ON "notas_fiscais"("tenant_id", "numero");

ALTER TABLE "notas_fiscais" DROP CONSTRAINT IF EXISTS "notas_fiscais_tenant_id_fkey";
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "nota_itens" (
    "id" SERIAL NOT NULL,
    "nota_id" INTEGER NOT NULL,
    "produto_id" INTEGER,
    "codigo" VARCHAR(60),
    "descricao" VARCHAR(500) NOT NULL,
    "unidade" VARCHAR(20) NOT NULL DEFAULT 'UN',
    "ncm" VARCHAR(20),
    "quantidade" DECIMAL(14,3) NOT NULL,
    "valor_unitario" DECIMAL(14,4),
    "valor_total" DECIMAL(14,2),

    CONSTRAINT "nota_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nota_itens_nota_id_idx" ON "nota_itens"("nota_id");
CREATE INDEX IF NOT EXISTS "nota_itens_produto_id_idx" ON "nota_itens"("produto_id");

ALTER TABLE "nota_itens" DROP CONSTRAINT IF EXISTS "nota_itens_nota_id_fkey";
ALTER TABLE "nota_itens" ADD CONSTRAINT "nota_itens_nota_id_fkey"
  FOREIGN KEY ("nota_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "nota_itens" DROP CONSTRAINT IF EXISTS "nota_itens_produto_id_fkey";
ALTER TABLE "nota_itens" ADD CONSTRAINT "nota_itens_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "estoque_movimentos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "nota_id" INTEGER,
    "caminhao_id" INTEGER,
    "motivo" VARCHAR(500),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_movimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "estoque_movimentos_tenant_id_idx" ON "estoque_movimentos"("tenant_id");
CREATE INDEX IF NOT EXISTS "estoque_movimentos_produto_id_idx" ON "estoque_movimentos"("produto_id");
CREATE INDEX IF NOT EXISTS "estoque_movimentos_nota_id_idx" ON "estoque_movimentos"("nota_id");
CREATE INDEX IF NOT EXISTS "estoque_movimentos_caminhao_id_idx" ON "estoque_movimentos"("caminhao_id");

ALTER TABLE "estoque_movimentos" DROP CONSTRAINT IF EXISTS "estoque_movimentos_tenant_id_fkey";
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "estoque_movimentos" DROP CONSTRAINT IF EXISTS "estoque_movimentos_produto_id_fkey";
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "estoque_movimentos" DROP CONSTRAINT IF EXISTS "estoque_movimentos_nota_id_fkey";
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_nota_id_fkey"
  FOREIGN KEY ("nota_id") REFERENCES "notas_fiscais"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "estoque_movimentos" DROP CONSTRAINT IF EXISTS "estoque_movimentos_caminhao_id_fkey";
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_caminhao_id_fkey"
  FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Extra tire positions for trailers / 4th axle (idempotent)
INSERT INTO "posicoes_pneus" ("nome_posicao")
SELECT v.nome FROM (VALUES
  ('Eixo 3 - Externo Esquerdo'),
  ('Eixo 3 - Interno Esquerdo'),
  ('Eixo 3 - Interno Direito'),
  ('Eixo 3 - Externo Direito'),
  ('Eixo 4 - Externo Esquerdo'),
  ('Eixo 4 - Interno Esquerdo'),
  ('Eixo 4 - Interno Direito'),
  ('Eixo 4 - Externo Direito'),
  ('Carreta - Eixo 1 - Externo Esquerdo'),
  ('Carreta - Eixo 1 - Interno Esquerdo'),
  ('Carreta - Eixo 1 - Interno Direito'),
  ('Carreta - Eixo 1 - Externo Direito'),
  ('Carreta - Eixo 2 - Externo Esquerdo'),
  ('Carreta - Eixo 2 - Interno Esquerdo'),
  ('Carreta - Eixo 2 - Interno Direito'),
  ('Carreta - Eixo 2 - Externo Direito'),
  ('Carreta - Eixo 3 - Externo Esquerdo'),
  ('Carreta - Eixo 3 - Interno Esquerdo'),
  ('Carreta - Eixo 3 - Interno Direito'),
  ('Carreta - Eixo 3 - Externo Direito'),
  ('Carreta - Estepe 1'),
  ('Carreta - Estepe 2')
) AS v(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM "posicoes_pneus" p WHERE p.nome_posicao = v.nome
);
