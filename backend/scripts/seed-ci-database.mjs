/**
 * Dados de referência que as migrations SQL inserem, mas `prisma db push`
 * (CI / banco vazio) não aplica. Idempotente.
 */
import prisma from "../src/lib/prisma.js";
import { ensureDefaultTiposGastos } from "../src/utils/tiposGastos.js";

const POSICOES_EXTRA = [
  "Eixo 3 - Externo Esquerdo",
  "Eixo 3 - Interno Esquerdo",
  "Eixo 3 - Interno Direito",
  "Eixo 3 - Externo Direito",
  "Eixo 4 - Externo Esquerdo",
  "Eixo 4 - Interno Esquerdo",
  "Eixo 4 - Interno Direito",
  "Eixo 4 - Externo Direito",
  "Carreta - Eixo 1 - Externo Esquerdo",
  "Carreta - Eixo 1 - Interno Esquerdo",
  "Carreta - Eixo 1 - Interno Direito",
  "Carreta - Eixo 1 - Externo Direito",
  "Carreta - Eixo 2 - Externo Esquerdo",
  "Carreta - Eixo 2 - Interno Esquerdo",
  "Carreta - Eixo 2 - Interno Direito",
  "Carreta - Eixo 2 - Externo Direito",
  "Carreta - Eixo 3 - Externo Esquerdo",
  "Carreta - Eixo 3 - Interno Esquerdo",
  "Carreta - Eixo 3 - Interno Direito",
  "Carreta - Eixo 3 - Externo Direito",
  "Carreta - Estepe 1",
  "Carreta - Estepe 2",
];

async function main() {
  const tipos = await ensureDefaultTiposGastos();
  console.log(`Seed CI: tipos de gasto ok (${tipos} novo(s)).`);

  for (const nome_posicao of POSICOES_EXTRA) {
    await prisma.posicoes_pneus.upsert({
      where: { nome_posicao },
      update: {},
      create: { nome_posicao },
    });
  }
  console.log(`Seed CI: ${POSICOES_EXTRA.length} posições de pneu ok.`);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_device_open_idx"
    ON "telemetry_device_assignments" ("device_id") WHERE "fim_em" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_caminhao_open_idx"
    ON "telemetry_device_assignments" ("caminhao_id") WHERE "fim_em" IS NULL
  `);
  console.log("Seed CI: índices parciais de telemetria ok.");

  // Unicidade fiscal: UNIQUE ... WHERE — Prisma não modela no schema; db push
  // pula a migration SQL. Espelha 20260908153000_fiscal_unicidade_emissao.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ctes_brasil_nfe_id_key"
    ON "fiscal_ctes" ("brasil_nfe_id")
    WHERE "brasil_nfe_id" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_mdfes_brasil_nfe_id_key"
    ON "fiscal_mdfes" ("brasil_nfe_id")
    WHERE "brasil_nfe_id" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_ctes_empresa_serie_numero_ambiente_key"
    ON "fiscal_ctes" ("tenant_id", "fiscal_empresa_id", "ambiente", "serie", "numero")
    WHERE "numero" IS NOT NULL
      AND "serie" IS NOT NULL
      AND "fiscal_empresa_id" IS NOT NULL
      AND "ambiente" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_mdfes_empresa_serie_numero_ambiente_key"
    ON "fiscal_mdfes" ("tenant_id", "fiscal_empresa_id", "ambiente", "serie", "numero")
    WHERE "numero" IS NOT NULL
      AND "serie" IS NOT NULL
      AND "fiscal_empresa_id" IS NOT NULL
      AND "ambiente" IS NOT NULL
  `);
  console.log("Seed CI: índices parciais de unicidade fiscal ok.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
