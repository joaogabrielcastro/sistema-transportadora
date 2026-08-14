-- Preço da peça (NF-e) + vínculo manutenção↔estoque
ALTER TABLE "produtos"
  ADD COLUMN IF NOT EXISTS "preco_custo" DECIMAL(14,4);

ALTER TABLE "checklist"
  ADD COLUMN IF NOT EXISTS "produto_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_produto_id_fkey'
  ) THEN
    ALTER TABLE "checklist"
      ADD CONSTRAINT "checklist_produto_id_fkey"
      FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "checklist_produto_id_idx" ON "checklist"("produto_id");

-- Preenche preço com a última NF-e já importada (se houver)
UPDATE "produtos" p
SET "preco_custo" = src.valor_unitario
FROM (
  SELECT DISTINCT ON (ni.produto_id)
    ni.produto_id,
    ni.valor_unitario
  FROM "nota_itens" ni
  WHERE ni.produto_id IS NOT NULL
    AND ni.valor_unitario IS NOT NULL
  ORDER BY ni.produto_id, ni.id DESC
) src
WHERE p.id = src.produto_id
  AND p.preco_custo IS NULL;
