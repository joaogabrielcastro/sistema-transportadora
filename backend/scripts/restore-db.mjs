#!/usr/bin/env node
/**
 * Restaura um dump gzip em um banco VAZIO e diferente do de origem.
 *
 *   node scripts/restore-db.mjs --file backups/atrack-....sql.gz --target postgresql://postgres:postgres@localhost:5434/atrack_restore
 *
 * Recusa se host+database forem os mesmos de DATABASE_URL.
 */
import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { assertRestoreTargetAllowed } from "../src/utils/backupDb.js";

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return "";
}

const file = arg("file");
const target = arg("target") || process.env.RESTORE_TARGET_URL || "";
const source = process.env.DATABASE_URL || "";

if (!file || !existsSync(file)) {
  console.error("Informe --file com um dump .sql.gz existente.");
  process.exit(1);
}

try {
  assertRestoreTargetAllowed(source, target);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const psql = spawn("psql", ["--set", "ON_ERROR_STOP=1", target], {
  stdio: ["pipe", "inherit", "inherit"],
});

try {
  await pipeline(createReadStream(file), createGunzip(), psql.stdin);
} catch {
  console.error("Falha ao enviar o dump para o psql.");
  process.exit(1);
}

const code = await new Promise((resolve) => {
  psql.on("close", resolve);
});

if (code !== 0) {
  console.error(`psql saiu com código ${code}. O banco de origem não foi alterado.`);
  process.exit(code || 1);
}

console.log("Restore concluído no banco de destino. Valide com SELECT count(*) nas tabelas críticas antes de promover.");
