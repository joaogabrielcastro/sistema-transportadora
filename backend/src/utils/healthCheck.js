import { statfs } from "node:fs/promises";
import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { OrdemColetaService } from "../services/OrdemColetaService.js";
import { getUploadsHealth } from "./uploadsHealth.js";
import { UPLOADS_ROOT } from "./uploadPaths.js";
import { pingRedis, isRedisConfigured } from "../lib/redis.js";
import { readWorkerHeartbeat } from "../lib/workerHeartbeat.js";
import { getOrdemColetaQueueMode, getOrdemColetaJobCounts } from "../queues/ordemColetaJobQueue.js";
import { getAverbacaoJobCounts } from "../queues/averbacaoJobQueue.js";
import { getTelemetryJobCounts } from "../queues/telemetryJobQueue.js";
import { readTelemetryIngestStatus } from "../services/telemetry/telemetryIngestStatus.js";
import { readBackupStatus } from "./backupDb.js";
import { isMailConfigured } from "./mailer.js";
import { isSentryConfigured } from "../lib/sentry.js";

/**
 * Monta status agregado a partir das probes (testável sem I/O).
 */
export function buildHealthPayload({
  dbOk,
  pdfReady,
  uploadsWritable,
  uploadsDetail,
  redisOk,
  redisConfigured,
  queueMode,
  uptime,
  isProd,
  mailConfigured,
  sentryConfigured,
  workerOk = null,
  workerRequired = false,
  workerAgeMs = null,
  queues = null,
  diskFreeBytes = null,
  pgConnections = null,
  poolMax = null,
  backup = null,
  lastJob = null,
  telemetryStatus = null,
  telemetryQueue = null,
}) {
  const issues = [];

  if (!dbOk) issues.push("database");
  if (!pdfReady) issues.push("pdf");
  if (!uploadsWritable) issues.push("uploads");
  if (redisConfigured && !redisOk) issues.push("redis");
  if (workerRequired && workerOk === false) issues.push("worker");

  const status = issues.length === 0 ? "healthy" : "degraded";

  const chromiumPath = OrdemColetaService.resolvePuppeteerExecutable();

  return {
    status,
    issues,
    timestamp: new Date().toISOString(),
    uptime,
    database: {
      ok: dbOk,
      connections: pgConnections ?? null,
      poolMax: poolMax ?? null,
    },
    redis: {
      configured: Boolean(redisConfigured),
      ok: redisConfigured ? Boolean(redisOk) : null,
      queueMode: queueMode || (redisConfigured ? "redis" : "memory"),
    },
    worker: {
      ok: workerOk,
      required: Boolean(workerRequired),
      ageMs: workerAgeMs,
      lastJob: lastJob
        ? {
            queue: lastJob.queue || null,
            ok: Boolean(lastJob.ok),
            at: lastJob.at || null,
            durationMs: lastJob.durationMs ?? null,
          }
        : null,
    },
    queues: queues || {
      ordemColeta: null,
      averbacao: null,
      telemetry: telemetryQueue,
    },
    storage: {
      writable: Boolean(uploadsWritable),
      freeBytes: diskFreeBytes,
    },
    backup: backup || { enabled: false, last: null },
    telemetry: {
      ingestionImplemented: true,
      lastDeviceSeen: telemetryStatus?.lastDeviceSeen ?? null,
      lastIngestionSuccess: telemetryStatus?.lastIngestionSuccess ?? null,
      lastIngestionError: telemetryStatus?.lastIngestionError ?? null,
    },
    pdf: isProd
      ? { ready: pdfReady }
      : {
          ready: pdfReady,
          chromiumPath,
          puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || null,
        },
    uploads: isProd ? { writable: uploadsWritable } : uploadsDetail,
    mail: { configured: Boolean(mailConfigured) },
    sentry: { configured: Boolean(sentryConfigured) },
  };
}

export async function runHealthCheck() {
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const uploadsDetail = await getUploadsHealth();
  const chromiumPath = OrdemColetaService.resolvePuppeteerExecutable();
  const pdfReady = Boolean(chromiumPath);
  const isProd = config.app.env === "production";

  const redisConfigured = isRedisConfigured();
  let redisOk = false;
  if (redisConfigured) {
    const redisPing = await pingRedis();
    redisOk = Boolean(redisPing.ok);
  }

  let workerOk = null;
  let workerAgeMs = null;
  let lastJob = null;
  if (redisConfigured) {
    const beat = await readWorkerHeartbeat();
    workerOk = beat.ok === true;
    workerAgeMs = beat.ageMs;
    lastJob = beat.data?.lastJob || null;
  }

  const workerRequired = Boolean(
    redisConfigured && config.workers?.runInApiProcess,
  );

  const [ordemCounts, averbacaoCounts, telemetryCounts] = await Promise.all([
    getOrdemColetaJobCounts(),
    getAverbacaoJobCounts(),
    getTelemetryJobCounts(),
  ]);

  let pgConnections = null;
  if (dbOk) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT count(*)::int AS n
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      pgConnections = Number(rows?.[0]?.n ?? 0);
    } catch {
      pgConnections = null;
    }
  }

  let diskFreeBytes = null;
  try {
    const stats = await statfs(UPLOADS_ROOT);
    diskFreeBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch {
    diskFreeBytes = null;
  }

  const poolMax = Number(process.env.DB_POOL_MAX || 10);

  const payload = buildHealthPayload({
    dbOk,
    pdfReady,
    uploadsWritable: uploadsDetail.writable,
    uploadsDetail,
    redisOk,
    redisConfigured,
    queueMode: getOrdemColetaQueueMode(),
    uptime: process.uptime(),
    isProd,
    mailConfigured: isMailConfigured(),
    sentryConfigured: isSentryConfigured(),
    workerOk,
    workerRequired,
    workerAgeMs,
    queues: {
      ordemColeta: ordemCounts,
      averbacao: averbacaoCounts,
      telemetry: telemetryCounts,
    },
    diskFreeBytes,
    pgConnections,
    poolMax: Number.isFinite(poolMax) ? poolMax : null,
    backup: readBackupStatus(),
    lastJob,
    telemetryStatus: readTelemetryIngestStatus(),
    telemetryQueue: telemetryCounts,
  });

  const httpStatus = payload.status === "healthy" ? 200 : 503;

  return { httpStatus, payload };
}
