/**
 * Produção com schema já criado (P3005): marca migrações antigas como aplicadas
 * e executa `migrate deploy` só para o que faltar (ex.: caminhao_documentos).
 *
 * Uso no container/host do backend:
 *   node scripts/baseline-and-deploy.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import prisma from "../src/lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");

const run = (cmd) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { cwd: backendRoot, stdio: "inherit", env: process.env });
};

const tableExists = async (tableName) => {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
};

const migrationApplied = async (name) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok
      FROM "_prisma_migrations"
      WHERE migration_name = ${name}
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
};

/** Prisma marca falha com finished_at NULL (e sem rollback). */
const migrationFailed = async (name) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok
      FROM "_prisma_migrations"
      WHERE migration_name = ${name}
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
};

const resolveIfNeeded = async (migrationName) => {
  if (await migrationApplied(migrationName)) {
    console.log(`(ok) Migração já registrada: ${migrationName}`);
    return;
  }
  run(`npx prisma migrate resolve --applied "${migrationName}"`);
};

/**
 * P3009: migração iniciou e falhou. Se o schema esperado já existe (SQL idempotente),
 * marca as applied; senão marca rolled-back para o próximo deploy tentar de novo.
 */
const healFailedMigration = async (migrationName, isSchemaReady) => {
  if (!(await migrationFailed(migrationName))) return;

  const ready = await isSchemaReady();
  if (ready) {
    console.log(
      `(heal) ${migrationName} falhou antes, mas o schema já está ok — marcando as applied.`,
    );
    run(`npx prisma migrate resolve --applied "${migrationName}"`);
  } else {
    console.log(
      `(heal) ${migrationName} falhou e o schema está incompleto — marcando rolled-back para reaplicar.`,
    );
    run(`npx prisma migrate resolve --rolled-back "${migrationName}"`);
  }
};

try {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.warn(
      "DATABASE_URL não definida — migrações ignoradas (normal em fase de build da imagem).",
    );
    process.exit(0);
  }

  const hasCaminhoes = await tableExists("caminhoes");
  if (!hasCaminhoes) {
    console.log(
      "Banco sem tabela caminhoes (vazio). Aplicando schema.prisma com db push…",
    );
    run("npx prisma db push");

    const migrationsDir = path.join(backendRoot, "prisma", "migrations");
    const migrationNames = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const name of migrationNames) {
      await resolveIfNeeded(name);
    }

    console.log(
      "\nConcluído (banco novo). Schema atual aplicado; histórico do Migrate alinhado.",
    );
    process.exit(0);
  }

  console.log("Baseline: banco já populado — alinhando histórico do Prisma Migrate…");

  await resolveIfNeeded("20260319_add_indexes_and_precision");

  if (await tableExists("ordens_coleta_envio")) {
    await resolveIfNeeded("20260511120000_ordens_coleta_envio");
  } else {
    console.log(
      "(info) Tabela ordens_coleta_envio ausente — será criada no migrate deploy.",
    );
  }

  if (await tableExists("caminhao_documentos")) {
    await resolveIfNeeded("20260518120000_caminhao_documentos");
  }

  // Destrava P3009 (comum quando a migração falha no meio e trava o prestart)
  await healFailedMigration(
    "20260806150000_frota_tipos_notas_estoque",
    async () =>
      (await columnExists("caminhoes", "tipo_veiculo")) &&
      (await tableExists("vinculos_composicao")) &&
      (await tableExists("produtos")) &&
      (await tableExists("notas_fiscais")),
  );

  await healFailedMigration(
    "20260806160000_tenant_billing_stripe",
    async () => columnExists("tenants", "billing_exempt"),
  );

  await healFailedMigration(
    "20260806180000_motoristas_audit_alerts",
    async () => tableExists("motoristas"),
  );

  await healFailedMigration(
    "20260806190000_checklist_proxima_manutencao",
    async () =>
      (await columnExists("checklist", "proxima_km")) ||
      (await columnExists("checklist", "proxima_data")),
  );

  await healFailedMigration(
    "20260811120000_nota_caminhao_gasto_produto",
    async () =>
      (await columnExists("notas_fiscais", "caminhao_id")) &&
      (await columnExists("gastos", "produto_id")),
  );

  await healFailedMigration(
    "20260814120000_produto_preco_estoque_caminhao",
    async () =>
      (await columnExists("produtos", "preco_custo")) &&
      (await columnExists("checklist", "produto_id")),
  );

  run("npx prisma migrate deploy");

  console.log("\nConcluído. Verifique se caminhao_documentos existe (PDFs por caminhão).");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
