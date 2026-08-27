-- Totais da NF (cabeçalho) + desconto/IPI por item
ALTER TABLE "notas_fiscais"
  ADD COLUMN IF NOT EXISTS "valor_desconto" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "valor_frete" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "valor_ipi" DECIMAL(14,2);

ALTER TABLE "nota_itens"
  ADD COLUMN IF NOT EXISTS "valor_desconto" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "valor_ipi" DECIMAL(14,2);
