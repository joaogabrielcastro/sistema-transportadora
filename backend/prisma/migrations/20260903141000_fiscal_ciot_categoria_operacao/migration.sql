-- CIOT: categoria da operação (Carga Lotação / Carga Fracionada / TAC-Agregado)
-- — item 3.2. Determina regras diferentes de prazo / cancelamento / retificação.
-- Hoje só existe tipo_operacao (1/2/3) no corpo da declaração, sem persistência
-- de uma categoria explícita.
--
-- ALTER apenas em fiscal_ciots (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack. CIOTs
-- antigos ficam com categoria_operacao NULL; o CiotService deriva de
-- tipo_operacao quando não informada.

ALTER TABLE "fiscal_ciots"
  -- lotacao | fracionada | tac_agregado
  ADD COLUMN IF NOT EXISTS "categoria_operacao" VARCHAR(20);
