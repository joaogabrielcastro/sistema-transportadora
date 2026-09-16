#!/usr/bin/env node
/**
 * Worker standalone da fila de averbação de seguro.
 * Em produção: RUN_ORDEM_WORKER_IN_API=false na API e rode este processo
 * (junto com o worker de ordem de coleta, ou no mesmo host com Redis).
 *
 *   node scripts/worker-averbacao.mjs
 */
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

import "dotenv/config";
import { config } from "../src/config/index.js";

if (!config.redis.url) {
  console.error("REDIS_URL é obrigatório para o worker standalone.");
  process.exit(1);
}

const { startAverbacaoWorker, closeAverbacaoQueue } = await import(
  "../src/queues/averbacaoJobQueue.js"
);

await startAverbacaoWorker();
console.log("Worker averbação iniciado (BullMQ).");

const shutdown = async (signal) => {
  console.log(`${signal} — encerrando worker…`);
  await closeAverbacaoQueue().catch(() => {});
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
