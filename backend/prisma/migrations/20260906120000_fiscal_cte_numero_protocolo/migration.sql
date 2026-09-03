-- CT-e: número do protocolo de autorização devolvido pelo provedor na emissão
-- (PARTE 3). Hoje fiscal_ctes não persistia esse dado e, por isso, o
-- cancelamento do CT-e mandava NumeroProtocolo vazio (o provedor resolvia só
-- pela chave). Passa a ser gravado na emissão a partir da resposta do provedor
-- e reutilizado no cancelamento.
--
-- ALTER apenas em fiscal_ctes (tabela NOSSA, criada em
-- 20260827200000_fiscal_transporte). Somente ADD COLUMN nullable. NENHUM ALTER
-- em tabela existente. SQL idempotente, estilo ATrack. CT-e já emitidos não são
-- afetados (numero_protocolo fica NULL e o cancelamento segue resolvendo pela
-- chave de acesso).

ALTER TABLE "fiscal_ctes"
  ADD COLUMN IF NOT EXISTS "numero_protocolo" VARCHAR(30);
