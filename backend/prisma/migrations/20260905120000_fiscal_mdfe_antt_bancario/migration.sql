-- MDF-e: dados bancários / PIX da instituição de pagamento do frete dentro do
-- grupo infANTT (item 0.1). CONFIRMADO com o payload real do provedor: os dados
-- vão no payload como `infoBancaria` dentro de `pagamentos[]`; aqui só
-- persistimos o que vier, para consulta. Todos os campos opcionais.
--
-- ALTER apenas em fiscal_mdfes (tabela NOSSA, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN nullable. NENHUM ALTER
-- em tabela existente. SQL idempotente, estilo ATrack. MDF-e já emitidos não
-- são afetados.

ALTER TABLE "fiscal_mdfes"
  ADD COLUMN IF NOT EXISTS "antt_cod_banco"            VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "antt_cod_agencia"          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "antt_cnpj_inst_pagamento"  VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "antt_pix"                   VARCHAR(120);
