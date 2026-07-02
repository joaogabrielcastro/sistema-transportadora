import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { OrdemColetaService } from "../services/OrdemColetaService.js";
import { getUploadsHealth } from "./uploadsHealth.js";

/**
 * Monta status agregado a partir das probes (testável sem I/O).
 */
export function buildHealthPayload({
  dbOk,
  pdfReady,
  uploadsWritable,
  uploadsDetail,
  uptime,
  isProd,
}) {
  const issues = [];

  if (!dbOk) issues.push("database");
  if (!pdfReady) issues.push("pdf");
  if (!uploadsWritable) issues.push("uploads");

  const status = issues.length === 0 ? "healthy" : "degraded";

  const chromiumPath = OrdemColetaService.resolvePuppeteerExecutable();

  return {
    status,
    issues,
    timestamp: new Date().toISOString(),
    uptime,
    database: { ok: dbOk },
    pdf: isProd
      ? { ready: pdfReady }
      : {
          ready: pdfReady,
          chromiumPath,
          puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || null,
        },
    uploads: isProd
      ? { writable: uploadsWritable }
      : uploadsDetail,
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

  const payload = buildHealthPayload({
    dbOk,
    pdfReady,
    uploadsWritable: uploadsDetail.writable,
    uploadsDetail,
    uptime: process.uptime(),
    isProd,
  });

  const httpStatus = payload.status === "healthy" ? 200 : 503;

  return { httpStatus, payload };
}
