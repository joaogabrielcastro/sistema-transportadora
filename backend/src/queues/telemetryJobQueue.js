import { createHash } from "node:crypto";
import { Queue, Worker, UnrecoverableError } from "bullmq";
import { logger } from "../utils/logger.js";
import {
  getBullMqConnection,
  isRedisConfigured,
  memoryQueueAllowed,
  redisRequiredError,
} from "../lib/redis.js";
import { noteWorkerJob } from "../lib/workerHeartbeat.js";
import {
  noteTelemetryFailure,
  noteTelemetrySuccess,
} from "../services/telemetry/telemetryIngestStatus.js";

export const TELEMETRY_QUEUE_NAME = "telemetry-ingest";

const MAX_CONCURRENT = 4;
const JOB_ATTEMPTS = 5;

/** @type {import('bullmq').Queue | null} */
let queue = null;
/** @type {import('bullmq').Worker | null} */
let worker = null;

let memActive = 0;
const memPending = [];
const memKeys = new Set();
const idleWaiters = [];

function jobKey(deviceId, eventId) {
  return createHash("sha256")
    .update(`${deviceId}\0${eventId}`)
    .digest("hex")
    .slice(0, 32);
}

function bullJobId(deviceId, eventId) {
  return `tel-${deviceId}-${jobKey(deviceId, eventId)}`;
}

function notifyIdle() {
  if (memActive === 0 && memPending.length === 0) {
    while (idleWaiters.length > 0) {
      idleWaiters.shift()();
    }
  }
}

export function waitForTelemetryQueueIdle() {
  if (isRedisConfigured() && queue) {
    return Promise.resolve();
  }
  if (memActive === 0 && memPending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    idleWaiters.push(resolve);
  });
}

function getQueue() {
  if (queue) return queue;
  const connection = getBullMqConnection();
  if (!connection) return null;

  queue = new Queue(TELEMETRY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
  return queue;
}

export async function processTelemetryJob(data) {
  const deviceId = Number(data?.deviceId);
  const eventId = data?.eventId;
  if (!Number.isInteger(deviceId) || deviceId <= 0 || !eventId) {
    throw new UnrecoverableError("Job de telemetria inválido");
  }

  const { applyIngestedTelemetryEvent } = await import(
    "../services/telemetry/telemetryPrep.js"
  );
  const result = await applyIngestedTelemetryEvent(data);
  if (result.skipped) {
    logger.info("telemetry job processed", {
      deviceId,
      eventId,
      skipped: result.reason,
    });
    return result;
  }

  noteTelemetrySuccess({ deviceId, eventId });
  logger.info("telemetry job processed", {
    deviceId,
    eventId,
    duplicate: result.duplicate === true,
    inserted: result.inserted === true,
  });
  return result;
}

async function memoryDrain() {
  if (memActive >= MAX_CONCURRENT || memPending.length === 0) return;

  memActive += 1;
  const job = memPending.shift();

  try {
    await processTelemetryJob(job);
  } catch (err) {
    noteTelemetryFailure({
      deviceId: job.deviceId,
      eventId: job.eventId,
      message: err?.message,
    });
    logger.error("telemetry job failed", {
      deviceId: job.deviceId,
      eventId: job.eventId,
      err: err?.message,
    });
  } finally {
    memKeys.delete(job.key);
    memActive -= 1;
    notifyIdle();
    void memoryDrain();
  }
}

function enqueueMemory(job) {
  if (memKeys.has(job.key)) {
    return { mode: "memory", duplicate: true, queued: false };
  }
  memKeys.add(job.key);
  memPending.push(job);
  logger.info("telemetry job queued", {
    deviceId: job.deviceId,
    eventId: job.eventId,
    mode: "memory",
  });
  void memoryDrain();
  return { mode: "memory", duplicate: false, queued: true };
}

export async function startTelemetryWorker() {
  if (worker) return worker;
  if (!isRedisConfigured()) {
    logger.info("Worker telemetria: modo memória (REDIS_URL ausente)");
    return null;
  }

  const connection = getBullMqConnection();
  worker = new Worker(TELEMETRY_QUEUE_NAME, async (job) => processTelemetryJob(job.data), {
    connection,
    concurrency: MAX_CONCURRENT,
  });

  worker.on("completed", (job) => {
    noteWorkerJob({
      queue: TELEMETRY_QUEUE_NAME,
      ok: true,
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : null,
    });
  });

  worker.on("failed", (job, err) => {
    noteTelemetryFailure({
      deviceId: job?.data?.deviceId,
      eventId: job?.data?.eventId,
      message: err?.message,
    });
    logger.error("telemetry job failed", {
      deviceId: job?.data?.deviceId,
      eventId: job?.data?.eventId,
      attemptsMade: job?.attemptsMade,
      err: err?.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("telemetry job failed", { err: err?.message });
  });

  logger.info("Worker telemetria iniciado (BullMQ/Redis)", {
    queue: TELEMETRY_QUEUE_NAME,
    concurrency: MAX_CONCURRENT,
  });

  return worker;
}

/**
 * Enfileira o ponto. jobId estável evita dois jobs do mesmo evento.
 * A gravação única continua no PostgreSQL.
 */
export async function enqueueTelemetryEvent(data) {
  const deviceId = Number(data.deviceId);
  const eventId = String(data.eventId);
  const key = jobKey(deviceId, eventId);
  const payload = {
    deviceId,
    eventId,
    recordedAt: data.recordedAt,
    receivedAt: data.receivedAt,
    latitude: data.latitude,
    longitude: data.longitude,
    speedKmh: data.speedKmh,
    ignition: data.ignition,
    key,
  };

  const q = getQueue();
  if (!q) {
    if (!memoryQueueAllowed()) {
      throw redisRequiredError();
    }
    return enqueueMemory(payload);
  }

  const jobId = bullJobId(deviceId, eventId);
  try {
    const existing = await q.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "failed") {
        await existing.remove().catch(() => {});
      } else {
        return { mode: "redis", duplicate: true, queued: false };
      }
    }

    await q.add("ingest", payload, { jobId });
    logger.info("telemetry job queued", {
      deviceId,
      eventId,
      mode: "redis",
    });
    return { mode: "redis", duplicate: false, queued: true };
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("job")) {
      return { mode: "redis", duplicate: true, queued: false };
    }
    throw err;
  }
}

export async function closeTelemetryQueue() {
  const closing = [];
  if (worker) {
    closing.push(worker.close());
    worker = null;
  }
  if (queue) {
    closing.push(queue.close());
    queue = null;
  }
  await Promise.allSettled(closing);
}

export function getTelemetryQueueMode() {
  return isRedisConfigured() ? "redis" : "memory";
}

export async function getTelemetryJobCounts() {
  try {
    const q = getQueue();
    if (!q) return null;
    return await q.getJobCounts("waiting", "active", "failed", "delayed");
  } catch (err) {
    logger.warn("Falha ao ler fila de telemetria", {
      err: String(err?.message || "unavailable").replace(
        /rediss?:\/\/\S+/gi,
        "redis://[redacted]",
      ),
    });
    return null;
  }
}
