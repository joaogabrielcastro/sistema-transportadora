-- Unicidade fiscal: identificador interno e numeração local.
-- brasil_nfe_id é gravado no claim, antes do POST, e não pode colidir.
-- série+número+ambiente+empresa só quando todos preenchidos (após autorização).

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ctes_brasil_nfe_id_key"
  ON "fiscal_ctes" ("brasil_nfe_id")
  WHERE "brasil_nfe_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_mdfes_brasil_nfe_id_key"
  ON "fiscal_mdfes" ("brasil_nfe_id")
  WHERE "brasil_nfe_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ctes_empresa_serie_numero_ambiente_key"
  ON "fiscal_ctes" ("tenant_id", "fiscal_empresa_id", "ambiente", "serie", "numero")
  WHERE "numero" IS NOT NULL
    AND "serie" IS NOT NULL
    AND "fiscal_empresa_id" IS NOT NULL
    AND "ambiente" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_mdfes_empresa_serie_numero_ambiente_key"
  ON "fiscal_mdfes" ("tenant_id", "fiscal_empresa_id", "ambiente", "serie", "numero")
  WHERE "numero" IS NOT NULL
    AND "serie" IS NOT NULL
    AND "fiscal_empresa_id" IS NOT NULL
    AND "ambiente" IS NOT NULL;
