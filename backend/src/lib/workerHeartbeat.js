import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { isRedisConfigured } from "./redis.js";

export const WORKER_HEARTBEAT_KEY = "atrack:worker:heartbeat";
export const WORKER_HEARTBEAT_TTL_SEC = 30;

let beatTimer = null;
let clientPromise = null;
let lastJob = null;

async function getClient() {
  if (!isRedisConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("ioredis").then(({ default: IORedis }) => {
      const client = new IORedis(config.redis.url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
        enableReadyCheck: true,
      });
      client.on("error", () => {
        logger.warn("Heartbeat Redis indisponível");
      });
      return client;
    });
  }
  return clientPromise;
}

export function noteWorkerJob(info) {
  lastJob = {
    queue: info?.queue || null,
    ok: Boolean(info?.ok),
    durationMs: Number.isFinite(info?.durationMs) ? info.durationMs : null,
    at: new Date().toISOString(),
  };
}

export function getLastWorkerJob() {
  return lastJob;
}

async function writeOnce(meta) {
  const client = await getClient();
  if (!client) return false;
  if (client.status !== "ready") {
    await client.connect().catch(() => {});
  }
  const payload = JSON.stringify({
    role: "worker",
    pid: process.pid,
    queues: meta.queues || [],
    startedAt: meta.startedAt,
    beatAt: new Date().toISOString(),
    lastJob,
  });
  await client.set(WORKER_HEARTBEAT_KEY, payload, "EX", WORKER_HEARTBEAT_TTL_SEC);
  return true;
}

export function startWorkerHeartbeat(meta = {}) {
  const state = {
    queues: meta.queues || [],
    startedAt: new Date().toISOString(),
  };
  const tick = () => {
    void writeOnce(state).catch((err) => {
      logger.warn("Falha ao gravar heartbeat do worker", {
        err: String(err?.message || "").replace(/rediss?:\/\/\S+/gi, "redis://[redacted]"),
      });
    });
  };
  tick();
  if (beatTimer) clearInterval(beatTimer);
  beatTimer = setInterval(tick, 10_000);
  beatTimer.unref?.();
  return stopWorkerHeartbeat;
}

export function stopWorkerHeartbeat() {
  if (beatTimer) {
    clearInterval(beatTimer);
    beatTimer = null;
  }
}

export async function readWorkerHeartbeat() {
  if (!isRedisConfigured()) {
    return { ok: null, configured: false, ageMs: null, data: null };
  }
  try {
    const client = await getClient();
    if (!client) return { ok: false, configured: true, ageMs: null, data: null };
    if (client.status !== "ready") {
      await client.connect();
    }
    const raw = await client.get(WORKER_HEARTBEAT_KEY);
    if (!raw) return { ok: false, configured: true, ageMs: null, data: null };
    const data = JSON.parse(raw);
    const beatAt = data?.beatAt ? Date.parse(data.beatAt) : Number.NaN;
    const ageMs = Number.isFinite(beatAt) ? Date.now() - beatAt : null;
    const fresh = ageMs != null && ageMs < WORKER_HEARTBEAT_TTL_SEC * 1000;
    return { ok: fresh, configured: true, ageMs, data };
  } catch {
    return { ok: false, configured: true, ageMs: null, data: null };
  }
}

export async function closeWorkerHeartbeat() {
  stopWorkerHeartbeat();
  if (!clientPromise) return;
  const client = await clientPromise.catch(() => null);
  clientPromise = null;
  if (client) {
    await client.quit().catch(() => client.disconnect());
  }
}
