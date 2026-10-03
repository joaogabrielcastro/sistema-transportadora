-- Impede duas NF-e do mesmo tenant com a mesma chave.
-- Notas sem chave (NULL) continuam podendo se repetir neste índice.
UPDATE "notas_fiscais"
SET "chave_acesso" = NULL
WHERE "chave_acesso" IS NOT NULL AND btrim("chave_acesso") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_tenant_chave_uidx"
  ON "notas_fiscais" ("tenant_id", "chave_acesso");

-- Número + série + CNPJ, tratando vazio e NULL como o mesmo valor.
CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_tenant_numero_uidx"
  ON "notas_fiscais" (
    "tenant_id",
    "numero",
    COALESCE("serie", ''),
    COALESCE("cnpj_emitente", '')
  );
