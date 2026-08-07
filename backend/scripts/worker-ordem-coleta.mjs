#!/usr/bin/env node
/**
 * Worker standalone para PDF/e-mail de ordem de coleta.
 * Em produção: RUN_ORDEM_WORKER_IN_API=false na API e rode este processo.
 *
 *   node scripts/worker-ordem-coleta.mjs
 */
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

import "dotenv/config";
import { config } from "../src/config/index.js";

if (!config.redis.url) {
  console.error("REDIS_URL é obrigatório para o worker standalone.");
  process.exit(1);
}

const { startOrdemColetaWorker, closeOrdemColetaQueue } = await import(
  "../src/queues/ordemColetaJobQueue.js"
);

await startOrdemColetaWorker();
console.log("Worker ordem-coleta iniciado (BullMQ).");

const shutdown = async (signal) => {
  console.log(`${signal} — encerrando worker…`);
  await closeOrdemColetaQueue().catch(() => {});
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
