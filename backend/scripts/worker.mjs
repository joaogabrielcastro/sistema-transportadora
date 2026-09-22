#!/usr/bin/env node
/**
 * Worker separado da API: PDF/e-mail, averbação e ingestão de telemetria.
 *
 *   npm run worker
 *
 * Na API: RUN_ORDEM_WORKER_IN_API=false
 * Health: GET http://127.0.0.1:${WORKER_HEALTH_PORT:-3021}/health
 */
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

import "dotenv/config";
import http from "node:http";
import { assertRedisForWorker, pingRedis } from "../src/lib/redis.js";
import {
  closeWorkerHeartbeat,
  readWorkerHeartbeat,
  startWorkerHeartbeat,
} from "../src/lib/workerHeartbeat.js";

await assertRedisForWorker();

const { startOrdemColetaWorker, closeOrdemColetaQueue, getOrdemColetaJobCounts } =
  await import("../src/queues/ordemColetaJobQueue.js");
const { startAverbacaoWorker, closeAverbacaoQueue, getAverbacaoJobCounts } =
  await import("../src/queues/averbacaoJobQueue.js");
const { startTelemetryWorker, closeTelemetryQueue, getTelemetryJobCounts } =
  await import("../src/queues/telemetryJobQueue.js");
const { readTelemetryIngestStatus } = await import(
  "../src/services/telemetry/telemetryIngestStatus.js"
);

await startOrdemColetaWorker();
await startAverbacaoWorker();
await startTelemetryWorker();
startWorkerHeartbeat({
  queues: ["ordem-coleta-envio", "averbacao-seguro", "telemetry-ingest"],
});

const port = Number(process.env.WORKER_HEALTH_PORT || 3021);
const server = http.createServer(async (req, res) => {
  const path = String(req.url || "").split("?")[0];
  if (path !== "/health") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "not_found" }));
    return;
  }

  const redis = await pingRedis();
  const beat = await readWorkerHeartbeat();
  const [ordemColeta, averbacao, telemetryQueue] = await Promise.all([
    getOrdemColetaJobCounts(),
    getAverbacaoJobCounts(),
    getTelemetryJobCounts(),
  ]);
  const telemetryStatus = readTelemetryIngestStatus();
  const ok = Boolean(redis.ok && beat.ok);
  const body = {
    role: "worker",
    status: ok ? "healthy" : "degraded",
    redis: { ok: Boolean(redis.ok) },
    worker: { ok: beat.ok === true, ageMs: beat.ageMs },
    queues: { ordemColeta, averbacao, telemetry: telemetryQueue },
    telemetry: {
      ingestionImplemented: true,
      lastDeviceSeen: telemetryStatus.lastDeviceSeen,
      lastIngestionSuccess: telemetryStatus.lastIngestionSuccess,
      lastIngestionError: telemetryStatus.lastIngestionError,
    },
  };
  res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Worker ATrack ouvindo health em :${port}`);
});

let closing = false;
const shutdown = async (signal) => {
  if (closing) return;
  closing = true;
  console.log(`${signal} — encerrando worker…`);
  server.close();
  await closeWorkerHeartbeat().catch(() => {});
  await closeOrdemColetaQueue().catch(() => {});
  await closeAverbacaoQueue().catch(() => {});
  await closeTelemetryQueue().catch(() => {});
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
