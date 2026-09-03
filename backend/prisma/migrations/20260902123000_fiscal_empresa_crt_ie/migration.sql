-- emit.CRT / emit.IE do CT-e: Código de Regime Tributário e Inscrição Estadual
-- da empresa emissora. O CRT define se o emitente está no Simples Nacional
-- (1 ou 4) ou no regime normal (2 ou 3) — usado para decidir a obrigatoriedade
-- do grupo IBS/CBS na emissão. Empresa sem CRT cadastrado dá erro claro na
-- emissão (validado no CteService), nunca crash.
--
-- ALTER apenas em tabela NOSSA (fiscal_empresas) — somente ADD COLUMN nullable.
-- SQL idempotente, estilo ATrack. Nenhuma coluna existente alterada.

ALTER TABLE "fiscal_empresas"
  -- CRT: 1 = Simples Nacional, 2 = SN excesso sublimite, 3 = Regime Normal, 4 = MEI
  ADD COLUMN IF NOT EXISTS "crt"                 SMALLINT,
  ADD COLUMN IF NOT EXISTS "inscricao_estadual" VARCHAR(20);
