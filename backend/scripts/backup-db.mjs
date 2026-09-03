#!/usr/bin/env node
/**
 * Backup lógico do PostgreSQL via pg_dump (gzip + retenção).
 *
 * Uso:
 *   npm run db:backup
 *   node scripts/backup-db.mjs --out=./backups
 *
 * Requisitos: `pg_dump` no PATH e DATABASE_URL.
 * Em produção: BACKUP_ENABLED=true na API (dump diário) ou agende este script no Coolify.
 */
import { config as loadEnv } from "dotenv";
import { runDatabaseBackup } from "../src/utils/backupDb.js";

loadEnv();

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outDir = outArg ? outArg.slice("--out=".length) : undefined;

try {
  const result = await runDatabaseBackup({ outDir });
  console.log(`Backup OK: ${result.file}`);
  if (result.uploaded) {
    console.log(`Enviado: ${result.uploaded}`);
  }
  if (result.removed?.length) {
    console.log(`Removidos (retenção): ${result.removed.join(", ")}`);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
