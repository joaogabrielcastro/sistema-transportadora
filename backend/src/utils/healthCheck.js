import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { OrdemColetaService } from "../services/OrdemColetaService.js";
import { getUploadsHealth } from "./uploadsHealth.js";
import { pingRedis, isRedisConfigured } from "../lib/redis.js";
import { getOrdemColetaQueueMode } from "../queues/ordemColetaJobQueue.js";
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
}) {
  const issues = [];

  if (!dbOk) issues.push("database");
  if (!pdfReady) issues.push("pdf");
  if (!uploadsWritable) issues.push("uploads");
  if (redisConfigured && !redisOk) issues.push("redis");

  const status = issues.length === 0 ? "healthy" : "degraded";

  const chromiumPath = OrdemColetaService.resolvePuppeteerExecutable();

  return {
    status,
    issues,
    timestamp: new Date().toISOString(),
    uptime,
    database: { ok: dbOk },
    redis: {
      configured: Boolean(redisConfigured),
      ok: redisConfigured ? Boolean(redisOk) : null,
      queueMode: queueMode || (redisConfigured ? "redis" : "memory"),
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
  });

  const httpStatus = payload.status === "healthy" ? 200 : 503;

  return { httpStatus, payload };
}
