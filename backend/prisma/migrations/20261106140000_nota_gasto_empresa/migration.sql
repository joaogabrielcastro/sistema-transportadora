-- Filial/empresa do grupo (Solofino | Colombocal | Transmotin) em notas e gastos.
ALTER TABLE "notas_fiscais" ADD COLUMN IF NOT EXISTS "empresa" VARCHAR(80);
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "empresa" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "notas_fiscais_tenant_id_empresa_idx"
  ON "notas_fiscais" ("tenant_id", "empresa");

CREATE INDEX IF NOT EXISTS "gastos_tenant_id_empresa_idx"
  ON "gastos" ("tenant_id", "empresa");
