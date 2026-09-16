import { Queue, Worker } from "bullmq";
import { logger } from "../utils/logger.js";
import { getBullMqConnection, isRedisConfigured } from "../lib/redis.js";

export const AVERBACAO_QUEUE_NAME = "averbacao-seguro";
export const AVERBACAO_DLQ_NAME = "averbacao-seguro-dlq";

const MAX_CONCURRENT = 2;
const JOB_ATTEMPTS = 5;

/** @type {import('bullmq').Queue | null} */
let queue = null;
/** @type {import('bullmq').Queue | null} */
let dlq = null;
/** @type {import('bullmq').Worker | null} */
let worker = null;

let memActive = 0;
const memPending = [];
const memQueuedIds = new Set();

async function memoryDrain() {
  if (memActive >= MAX_CONCURRENT || memPending.length === 0) return;
  memActive += 1;
  const job = memPending.shift();
  memQueuedIds.delete(job.averbacaoId);
  try {
    const { AverbacaoService } = await import(
      "../services/averbacao/AverbacaoService.js"
    );
    await AverbacaoService.processarPorId(job.averbacaoId, job.tenantId);
  } catch (err) {
    logger.error("Fila averbação (memória): job falhou", {
      averbacaoId: job.averbacaoId,
      tenantId: job.tenantId,
      err: err?.message,
    });
  } finally {
    memActive -= 1;
    void memoryDrain();
  }
}

function enqueueMemory(averbacaoId, tenantId) {
  const id = Number(averbacaoId);
  if (memQueuedIds.has(id)) return;
  memQueuedIds.add(id);
  memPending.push({ averbacaoId: id, tenantId: Number(tenantId) });
  void memoryDrain();
}

function getDlq() {
  if (dlq) return dlq;
  const connection = getBullMqConnection();
  if (!connection) return null;
  dlq = new Queue(AVERBACAO_DLQ_NAME, { connection });
  return dlq;
}

function getQueue() {
  if (queue) return queue;
  const connection = getBullMqConnection();
  if (!connection) return null;
  queue = new Queue(AVERBACAO_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 0 },
    },
  });
  return queue;
}

async function processJob(job) {
  const { averbacaoId, tenantId } = job.data || {};
  if (!averbacaoId || !tenantId) {
    throw new Error("Job de averbação inválido (averbacaoId/tenantId)");
  }
  const { AverbacaoService } = await import(
    "../services/averbacao/AverbacaoService.js"
  );
  return AverbacaoService.processarPorId(averbacaoId, tenantId);
}

export async function startAverbacaoWorker() {
  if (worker) return worker;
  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === "production") {
      logger.error("Worker averbação: Redis obrigatório em produção — jobs não podem ficar só em memória");
      return null;
    }
    logger.info("Worker averbação: modo memória (REDIS_URL ausente)");
    return null;
  }
  const connection = getBullMqConnection();
  worker = new Worker(AVERBACAO_QUEUE_NAME, processJob, {
    connection,
    concurrency: MAX_CONCURRENT,
  });
  worker.on("completed", (job) => {
    logger.info("Averbação job concluído", {
      jobId: job.id,
      averbacaoId: job.data?.averbacaoId,
    });
  });
  worker.on("failed", async (job, err) => {
    logger.error("Averbação job falhou", {
      jobId: job?.id,
      averbacaoId: job?.data?.averbacaoId,
      tenantId: job?.data?.tenantId,
      attemptsMade: job?.attemptsMade,
      err: err?.message,
    });
    if (job && job.attemptsMade >= JOB_ATTEMPTS) {
      try {
        const dead = getDlq();
        if (dead) {
          await dead.add(
            "averbacao-dlq",
            {
              averbacaoId: job.data?.averbacaoId,
              tenantId: job.data?.tenantId,
              failedReason: err?.message,
              failedAt: new Date().toISOString(),
            },
            { jobId: `dlq-${job.data?.averbacaoId}` },
          );
        }
      } catch (dlqErr) {
        logger.error("Falha ao gravar averbação na DLQ", {
          averbacaoId: job?.data?.averbacaoId,
          err: dlqErr?.message,
        });
      }
    }
  });
  worker.on("error", (err) => {
    logger.error("Worker averbação erro", { err: err?.message });
  });
  logger.info("Worker averbação iniciado (BullMQ/Redis)", {
    queue: AVERBACAO_QUEUE_NAME,
    concurrency: MAX_CONCURRENT,
  });
  return worker;
}

export async function enqueueAverbacaoJob(averbacaoId, tenantId) {
  const id = Number(averbacaoId);
  const tid = Number(tenantId);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(tid) || tid <= 0) {
    throw new Error("averbacaoId/tenantId inválido para fila");
  }
  const q = getQueue();
  if (!q) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error(
        "Redis indisponível — averbação não pode usar fila em memória em produção.",
      );
      err.statusCode = 503;
      throw err;
    }
    enqueueMemory(id, tid);
    return { mode: "memory", averbacaoId: id };
  }
  const jobId = `averbacao-${id}`;
  try {
    const existing = await q.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "waiting" || state === "active" || state === "delayed") {
        return { mode: "redis", averbacaoId: id, reused: true, state };
      }
      await existing.remove().catch(() => {});
    }
    await q.add("processar-averbacao", { averbacaoId: id, tenantId: tid }, { jobId });
    return { mode: "redis", averbacaoId: id };
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("job")) {
      logger.warn("Job averbação já existia na fila", {
        averbacaoId: id,
        err: err?.message,
      });
      return { mode: "redis", averbacaoId: id, reused: true };
    }
    throw err;
  }
}

export async function closeAverbacaoQueue() {
  const closing = [];
  if (worker) {
    closing.push(worker.close());
    worker = null;
  }
  if (queue) {
    closing.push(queue.close());
    queue = null;
  }
  if (dlq) {
    closing.push(dlq.close());
    dlq = null;
  }
  await Promise.allSettled(closing);
}
