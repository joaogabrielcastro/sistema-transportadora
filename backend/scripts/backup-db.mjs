#!/usr/bin/env node
/**
 * Backup lógico do PostgreSQL via pg_dump.
 *
 * Uso:
 *   npm run db:backup
 *   node scripts/backup-db.mjs --out=./backups
 *
 * Requisitos: `pg_dump` no PATH (cliente PostgreSQL) e DATABASE_URL definido.
 * Agende no Coolify/cron (ex.: diário 03:00).
 */
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL não definido.");
  process.exit(1);
}

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outDir = outArg
  ? outArg.slice("--out=".length)
  : process.env.BACKUP_DIR || join(process.cwd(), "backups");

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = join(outDir, `atrack-${stamp}.sql`);

const result = spawnSync(
  "pg_dump",
  ["--no-owner", "--no-acl", "--format=plain", `--file=${file}`, databaseUrl],
  { encoding: "utf8", env: process.env },
);

if (result.error) {
  console.error(
    "Falha ao executar pg_dump. Instale o cliente PostgreSQL ou use snapshot do provedor.",
    result.error.message,
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "pg_dump falhou");
  process.exit(result.status || 1);
}

console.log(`Backup OK: ${file}`);
