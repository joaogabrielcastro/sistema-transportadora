-- Litros de abastecimento: NF-e de combustível costuma trazer 3–4 casas
-- (qCom). DECIMAL(10,2) arredondava e o total da nota não batia.
ALTER TABLE "gastos"
  ALTER COLUMN "quantidade_combustivel" TYPE DECIMAL(14,4);

-- Quantidade de item na NF-e também pode ter até 4 casas (ex.: litros).
ALTER TABLE "nota_itens"
  ALTER COLUMN "quantidade" TYPE DECIMAL(14,4);

ALTER TABLE "estoque_movimentos"
  ALTER COLUMN "quantidade" TYPE DECIMAL(14,4);

ALTER TABLE "produtos"
  ALTER COLUMN "saldo" TYPE DECIMAL(14,4);
