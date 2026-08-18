ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "origem" VARCHAR(20) NOT NULL DEFAULT 'xml';

ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "observacao" TEXT;

ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "data_vencimento" DATE;

ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "condicao_pagamento" VARCHAR(80);

UPDATE "notas_fiscais"
SET "origem" = 'xml'
WHERE "origem" IS NULL OR "origem" = '';
