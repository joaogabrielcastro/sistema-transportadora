import { Queue, Worker } from "bullmq";
import { logger } from "../utils/logger.js";
import { getBullMqConnection, isRedisConfigured } from "../lib/redis.js";

export const ORDEM_COLETA_QUEUE_NAME = "ordem-coleta-envio";

const MAX_CONCURRENT = 1;
const JOB_ATTEMPTS = 3;

/** @type {import('bullmq').Queue | null} */
let queue = null;
/** @type {import('bullmq').Worker | null} */
let worker = null;

// --- Fallback em memória (dev/test sem Redis) ---
let memActive = 0;
const memPending = [];
const memQueuedIds = new Set();

async function memoryDrain() {
  if (memActive >= MAX_CONCURRENT || memPending.length === 0) return;

  memActive += 1;
  const job = memPending.shift();
  memQueuedIds.delete(job.envioId);

  try {
    const { OrdemColetaService } = await import(
      "../services/OrdemColetaService.js"
    );
    await OrdemColetaService.processarEnvioPorId(job.envioId, job.parsed);
  } catch (err) {
    logger.error("Fila ordem coleta (memória): job falhou", {
      envioId: job.envioId,
      err: err?.message,
    });
  } finally {
    memActive -= 1;
    void memoryDrain();
  }
}

function enqueueMemory(envioId, parsed) {
  const id = Number(envioId);
  if (memQueuedIds.has(id)) return;
  memQueuedIds.add(id);
  memPending.push({ envioId: id, parsed });
  void memoryDrain();
}

function getQueue() {
  if (queue) return queue;
  const connection = getBullMqConnection();
  if (!connection) return null;

  queue = new Queue(ORDEM_COLETA_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
  return queue;
}

async function processJob(job) {
  const { envioId, parsed } = job.data || {};
  if (!envioId || !parsed) {
    throw new Error("Job de ordem de coleta inválido (envioId/parsed)");
  }

  const { OrdemColetaService } = await import(
    "../services/OrdemColetaService.js"
  );
  return OrdemColetaService.processarEnvioPorId(envioId, parsed);
}

/**
 * Inicia o Worker BullMQ (chame no boot do server).
 * Sem Redis → no-op (usa memória no enqueue).
 */
export async function startOrdemColetaWorker() {
  if (worker) return worker;
  if (!isRedisConfigured()) {
    logger.info("Worker ordem coleta: modo memória (REDIS_URL ausente)");
    return null;
  }

  const connection = getBullMqConnection();
  worker = new Worker(ORDEM_COLETA_QUEUE_NAME, processJob, {
    connection,
    concurrency: MAX_CONCURRENT,
  });

  worker.on("completed", (job) => {
    logger.info("Ordem coleta job concluído", {
      jobId: job.id,
      envioId: job.data?.envioId,
    });
  });

  worker.on("failed", (job, err) => {
    logger.error("Ordem coleta job falhou", {
      jobId: job?.id,
      envioId: job?.data?.envioId,
      attemptsMade: job?.attemptsMade,
      err: err?.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("Worker ordem coleta erro", { err: err?.message });
  });

  logger.info("Worker ordem coleta iniciado (BullMQ/Redis)", {
    queue: ORDEM_COLETA_QUEUE_NAME,
    concurrency: MAX_CONCURRENT,
  });

  return worker;
}

/**
 * Enfileira geração de PDF + SMTP.
 * Com Redis: BullMQ durable + jobId único por envio.
 * Sem Redis: fila em memória (dev/test).
 */
export async function enqueueOrdemEnvio(envioId, parsed) {
  const id = Number(envioId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("envioId inválido para fila");
  }

  const q = getQueue();
  if (!q) {
    enqueueMemory(id, parsed);
    return { mode: "memory", envioId: id };
  }

  const jobId = `envio-${id}`;

  try {
    const existing = await q.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "waiting" || state === "active" || state === "delayed") {
        return { mode: "redis", envioId: id, reused: true, state };
      }
      // completed/failed: remove para permitir reprocessar (ex.: retomar pendentes)
      await existing.remove().catch(() => {});
    }

    await q.add(
      "processar-envio",
      { envioId: id, parsed },
      { jobId },
    );

    return { mode: "redis", envioId: id };
  } catch (err) {
    // JobId duplicado em corrida — outro processo já enfileirou
    if (String(err?.message || "").toLowerCase().includes("job")) {
      logger.warn("Job ordem coleta já existia na fila", {
        envioId: id,
        err: err?.message,
      });
      return { mode: "redis", envioId: id, reused: true };
    }
    throw err;
  }
}

export async function closeOrdemColetaQueue() {
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

export function getOrdemColetaQueueMode() {
  return isRedisConfigured() ? "redis" : "memory";
}
