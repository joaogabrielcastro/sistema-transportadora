-- Destino sugerido da NF-e + vínculo gasto↔estoque
ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "caminhao_id" INTEGER;

ALTER TABLE "gastos"
  ADD COLUMN IF NOT EXISTS "produto_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notas_fiscais_caminhao_id_fkey'
  ) THEN
    ALTER TABLE "notas_fiscais"
      ADD CONSTRAINT "notas_fiscais_caminhao_id_fkey"
      FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gastos_produto_id_fkey'
  ) THEN
    ALTER TABLE "gastos"
      ADD CONSTRAINT "gastos_produto_id_fkey"
      FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notas_fiscais_caminhao_id_idx" ON "notas_fiscais"("caminhao_id");
CREATE INDEX IF NOT EXISTS "gastos_produto_id_idx" ON "gastos"("produto_id");
