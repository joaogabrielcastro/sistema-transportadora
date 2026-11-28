-- Controle de viagens e operações.
-- Só adiciona tabelas e colunas opcionais (gastos existentes não mudam); idempotente.

CREATE TABLE IF NOT EXISTS "viagens" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "numero" INTEGER NOT NULL,
  "caminhao_id" INTEGER NOT NULL,
  "motorista_id" INTEGER,
  "motorista_nome" VARCHAR(120),
  "status" VARCHAR(20) NOT NULL DEFAULT 'em_andamento',
  "origem" VARCHAR(160) NOT NULL,
  "destino" VARCHAR(160) NOT NULL,
  "saida_em" TIMESTAMPTZ(6) NOT NULL,
  "chegada_em" TIMESTAMPTZ(6),
  "km_inicial" INTEGER NOT NULL,
  "km_final" INTEGER,
  "observacoes" TEXT,
  "observacoes_encerramento" TEXT,
  "ocorrencias" TEXT,
  "motivo_cancelamento" TEXT,
  "criado_por" INTEGER,
  "iniciado_por" INTEGER,
  "encerrado_por" INTEGER,
  "cancelado_por" INTEGER,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "iniciado_em" TIMESTAMPTZ(6),
  "encerrado_em" TIMESTAMPTZ(6),
  "cancelado_em" TIMESTAMPTZ(6),
  CONSTRAINT "viagens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "viagens_caminhao_id_fkey" FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "viagens_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "viagens_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "viagens_iniciado_por_fkey" FOREIGN KEY ("iniciado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "viagens_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "viagens_cancelado_por_fkey" FOREIGN KEY ("cancelado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "viagens_status_check" CHECK ("status" IN ('planejada', 'em_andamento', 'finalizada', 'cancelada')),
  CONSTRAINT "viagens_km_check" CHECK ("km_inicial" >= 0 AND ("km_final" IS NULL OR "km_final" >= "km_inicial"))
);
CREATE UNIQUE INDEX IF NOT EXISTS "viagens_tenant_id_numero_key" ON "viagens" ("tenant_id", "numero");
CREATE INDEX IF NOT EXISTS "viagens_tenant_id_status_idx" ON "viagens" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "viagens_tenant_id_saida_em_idx" ON "viagens" ("tenant_id", "saida_em");
CREATE INDEX IF NOT EXISTS "viagens_caminhao_id_saida_em_idx" ON "viagens" ("caminhao_id", "saida_em");
CREATE INDEX IF NOT EXISTS "viagens_motorista_id_saida_em_idx" ON "viagens" ("motorista_id", "saida_em");
-- Um caminhão só pode estar em uma viagem em andamento por vez (garantido também com concorrência).
CREATE UNIQUE INDEX IF NOT EXISTS "viagens_caminhao_em_andamento_key" ON "viagens" ("caminhao_id") WHERE "status" = 'em_andamento';

-- Histórico de cada ação (quem, quando, o que mudou). Nunca é apagado pela aplicação.
CREATE TABLE IF NOT EXISTS "viagem_historico" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "viagem_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "user_nome" VARCHAR(120),
  "acao" VARCHAR(40) NOT NULL,
  "despesa_id" INTEGER,
  "alteracoes" JSONB,
  "motivo" TEXT,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viagem_historico_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "viagem_historico_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "viagem_historico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "viagem_historico_viagem_id_criado_em_idx" ON "viagem_historico" ("viagem_id", "criado_em");
CREATE INDEX IF NOT EXISTS "viagem_historico_tenant_id_criado_em_idx" ON "viagem_historico" ("tenant_id", "criado_em");

-- Despesas da viagem são gastos comuns ligados à viagem: entram nos relatórios
-- e no custo por km da frota sem lançamento duplicado.
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "viagem_id" INTEGER;
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "criado_por" INTEGER;
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "registrado_em" TIMESTAMPTZ(6);
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "comprovante_path" VARCHAR(500);
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "comprovante_nome" VARCHAR(255);
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "comprovante_mime" VARCHAR(100);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gastos_viagem_id_fkey') THEN
    ALTER TABLE "gastos" ADD CONSTRAINT "gastos_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gastos_criado_por_fkey') THEN
    ALTER TABLE "gastos" ADD CONSTRAINT "gastos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "gastos_viagem_id_idx" ON "gastos" ("viagem_id");
