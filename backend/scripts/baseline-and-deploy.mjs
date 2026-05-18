/**
 * Produção com schema já criado (P3005): marca migrações antigas como aplicadas
 * e executa `migrate deploy` só para o que faltar (ex.: caminhao_documentos).
 *
 * Uso no container/host do backend:
 *   node scripts/baseline-and-deploy.mjs
 */
import { execSync } from "node:child_process";
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

const migrationApplied = async (name) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok FROM "_prisma_migrations" WHERE migration_name = ${name} LIMIT 1
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

try {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.warn(
      "DATABASE_URL não definida — migrações ignoradas (normal em fase de build da imagem).",
    );
    process.exit(0);
  }

  const hasCaminhoes = await tableExists("caminhoes");
  if (!hasCaminhoes) {
    console.error(
      "Banco sem tabela caminhoes. Use `npx prisma migrate deploy` em banco vazio ou restaure o backup.",
    );
    process.exit(1);
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

  run("npx prisma migrate deploy");

  console.log("\nConcluído. Verifique se caminhao_documentos existe (PDFs por caminhão).");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
