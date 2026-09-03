import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { config } from "../config/index.js";
import { logger } from "./logger.js";
import { captureException } from "../lib/sentry.js";

export const BACKUP_NAME_RE =
  /^atrack-\d{4}-\d{2}-\d{2}T[\d-]+\.sql(\.gz)?$/;

export function backupFileName(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `atrack-${stamp}.sql.gz`;
}

export function listBackupNames(names) {
  return (names || []).filter((n) => BACKUP_NAME_RE.test(n)).sort();
}

/** Converte `atrack-2026-09-02T06-00-00.sql.gz` em epoch, ou NaN. */
export function backupNameTimestamp(name) {
  const m = String(name || "").match(
    /^atrack-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/,
  );
  if (!m) return Number.NaN;
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
}

export function backupsOlderThan(names, retentionDays, now = new Date()) {
  const days = Number(retentionDays);
  const keepMs =
    Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - keepMs;
  return listBackupNames(names).filter((name) => {
    const ts = backupNameTimestamp(name);
    return Number.isFinite(ts) && ts < cutoff;
  });
}

export function msUntilNextHourUtc(hour, now = new Date()) {
  const h = Number(hour);
  const hourUtc = Number.isFinite(h)
    ? Math.min(23, Math.max(0, Math.floor(h)))
    : 6;
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hourUtc,
    0,
    0,
    0,
  );
  const ts = next <= now.getTime() ? next + 24 * 60 * 60 * 1000 : next;
  return ts - now.getTime();
}

export function resolveBackupDir(explicitDir) {
  const fromEnv = (process.env.BACKUP_DIR || "").trim();
  if (explicitDir) return explicitDir;
  if (fromEnv) return fromEnv;
  return join(process.cwd(), "backups");
}

export function retentionDays() {
  const n = Number(process.env.BACKUP_RETENTION_DAYS || 7);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 7;
}

export function isBackupEnabled() {
  const raw = String(process.env.BACKUP_ENABLED || "").toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

function s3Prefix() {
  const p = (process.env.BACKUP_S3_PREFIX || "backups/").trim() || "backups/";
  return p.endsWith("/") ? p : `${p}/`;
}

async function uploadBackupToS3(localPath, fileName) {
  if (!config.storage.s3Enabled) return null;
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: config.storage.region,
    endpoint: config.storage.endpoint || undefined,
    forcePathStyle: Boolean(config.storage.endpoint),
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });
  const key = `${s3Prefix()}${fileName}`.replace(/\\/g, "/");
  await client.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: "application/gzip",
    }),
  );
  return `s3://${key}`;
}

function rotateLocalBackups(dir) {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir);
  const stale = backupsOlderThan(names, retentionDays());
  const removed = [];
  for (const name of stale) {
    try {
      unlinkSync(join(dir, name));
      removed.push(name);
    } catch (err) {
      logger.warn("Falha ao remover backup antigo", {
        file: name,
        error: err?.message,
      });
    }
  }
  return removed;
}

/**
 * Gera dump gzipado. Requer `pg_dump` no PATH e DATABASE_URL.
 */
export async function runDatabaseBackup({ outDir, databaseUrl } = {}) {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    const err = new Error("DATABASE_URL não definido.");
    err.code = "BACKUP_NO_DATABASE_URL";
    throw err;
  }

  const dir = resolveBackupDir(outDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const fileName = backupFileName();
  const filePath = join(dir, fileName);

  await new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const dump = spawn(
      "pg_dump",
      ["--no-owner", "--no-acl", "--format=plain", url],
      { env: process.env },
    );

    const gzip = createGzip();
    const out = createWriteStream(filePath);
    let stderr = "";

    dump.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    dump.on("error", (err) => {
      fail(
        Object.assign(
          new Error(
            `Falha ao executar pg_dump. Instale o cliente PostgreSQL ou use snapshot do provedor. ${err.message}`,
          ),
          { code: "BACKUP_PG_DUMP_MISSING", cause: err },
        ),
      );
    });

    dump.on("close", (code) => {
      if (code && code !== 0) {
        gzip.destroy(
          new Error(stderr.trim() || `pg_dump saiu com código ${code}`),
        );
      }
    });

    pipeline(dump.stdout, gzip, out)
      .then(() => {
        if (dump.exitCode && dump.exitCode !== 0) {
          fail(
            new Error(stderr.trim() || `pg_dump saiu com código ${dump.exitCode}`),
          );
          return;
        }
        ok();
      })
      .catch(fail);
  });

  let uploaded = null;
  try {
    uploaded = await uploadBackupToS3(filePath, fileName);
  } catch (err) {
    logger.warn("Backup local ok, mas upload S3 falhou", {
      error: err?.message,
    });
  }

  const removed = rotateLocalBackups(dir);

  return { file: filePath, uploaded, removed };
}

let schedulerTimer = null;

export function stopBackupScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

function scheduleNext(hourUtc) {
  const wait = msUntilNextHourUtc(hourUtc);
  schedulerTimer = setTimeout(() => {
    void runScheduledBackup(hourUtc);
  }, wait);
  schedulerTimer.unref?.();
}

async function runScheduledBackup(hourUtc) {
  try {
    const result = await runDatabaseBackup();
    logger.info("Backup automático concluído", {
      file: result.file,
      uploaded: result.uploaded,
      removed: result.removed?.length || 0,
    });
  } catch (err) {
    logger.error("Backup automático falhou", err);
    captureException(err, { job: "database-backup" });
  } finally {
    scheduleNext(hourUtc);
  }
}

/** Agenda dump diário (UTC). Não dispara no boot, salvo BACKUP_ON_START. */
export function startBackupScheduler() {
  stopBackupScheduler();
  if (!isBackupEnabled()) return { started: false, reason: "disabled" };
  if (process.env.NODE_ENV === "test") {
    return { started: false, reason: "test" };
  }

  const hour = Number(process.env.BACKUP_HOUR_UTC || 6);
  const hourUtc = Number.isFinite(hour)
    ? Math.min(23, Math.max(0, Math.floor(hour)))
    : 6;

  const onStart = ["1", "true", "yes", "on"].includes(
    String(process.env.BACKUP_ON_START || "").toLowerCase(),
  );
  if (onStart) {
    void runScheduledBackup(hourUtc);
  } else {
    scheduleNext(hourUtc);
  }

  logger.info("Backup automático agendado", {
    hourUtc,
    dir: resolveBackupDir(),
    retentionDays: retentionDays(),
    onStart,
  });

  return { started: true, hourUtc };
}
