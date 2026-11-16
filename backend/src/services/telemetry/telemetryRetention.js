import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { RAW_EVENT_RETENTION_DAYS } from "./telemetryPolicy.js";

const DEFAULT_BATCH = 5_000;

/**
 * Remove eventos brutos mais antigos que a retenção.
 * Não altera current_state nem telemetry_daily.
 */
export async function purgeExpiredTelemetryEvents({
  retentionDays = RAW_EVENT_RETENTION_DAYS,
  batchSize = DEFAULT_BATCH,
} = {}) {
  const days = Number(retentionDays);
  const limit = Number(batchSize);
  if (!Number.isFinite(days) || days < 1) {
    return { deleted: 0, cutoff: null };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await prisma.$executeRaw`
    DELETE FROM telemetry_events
    WHERE id IN (
      SELECT id FROM telemetry_events
      WHERE recebido_em < ${cutoff}
      ORDER BY recebido_em ASC
      LIMIT ${limit}
    )
  `;

  const deleted = Number(result) || 0;
  if (deleted > 0) {
    logger.info("telemetry retention purge", {
      deleted,
      cutoff: cutoff.toISOString(),
      retentionDays: days,
    });
  }
  return { deleted, cutoff };
}

let retentionTimer = null;

export function startTelemetryRetentionJob({
  intervalMs = Number(process.env.TELEMETRY_RETENTION_INTERVAL_MS || 3_600_000),
} = {}) {
  if (retentionTimer) return retentionTimer;

  const tick = async () => {
    try {
      let total = 0;
      for (let i = 0; i < 20; i += 1) {
        const { deleted } = await purgeExpiredTelemetryEvents();
        total += deleted;
        if (deleted < DEFAULT_BATCH) break;
      }
      if (total > 0) {
        logger.info("telemetry retention cycle done", { deleted: total });
      }
    } catch (err) {
      logger.error("telemetry retention failed", { err: err?.message });
    }
  };

  // Primeira passagem atrasada para não competir com o boot.
  const initial = setTimeout(() => void tick(), 60_000);
  retentionTimer = setInterval(() => void tick(), intervalMs);
  if (typeof retentionTimer.unref === "function") retentionTimer.unref();
  if (typeof initial.unref === "function") initial.unref();

  logger.info("telemetry retention job scheduled", {
    intervalMs,
    retentionDays: RAW_EVENT_RETENTION_DAYS,
  });
  return retentionTimer;
}

export function stopTelemetryRetentionJob() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
