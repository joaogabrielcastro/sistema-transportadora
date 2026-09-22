import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

let warnedMissing = false;

export function isRedisConfigured() {
  return Boolean(config.redis?.url);
}

/** Fila em memória só existe fora de produção, e o log deixa isso explícito. */
export function memoryQueueAllowed() {
  return (process.env.NODE_ENV || "development") !== "production";
}

export function redisRequiredError() {
  const err = new Error("Redis é obrigatório em produção.");
  err.statusCode = 503;
  err.code = "REDIS_REQUIRED";
  return err;
}

function safeRedisError(err) {
  return String(err?.message || "falha de conexão").replace(
    /rediss?:\/\/\S+/gi,
    "redis://[redacted]",
  );
}

export function getRedisConnectionOptions() {
  const url = config.redis?.url;
  if (!url) {
    return null;
  }

  // BullMQ/Worker exigem maxRetriesPerRequest: null
  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

/**
 * Retorna opções de conexão para Queue/Worker.
 * Sem REDIS_URL → null (caller deve usar fallback em memória).
 */
export function getBullMqConnection() {
  const opts = getRedisConnectionOptions();
  if (!opts) {
    if (!warnedMissing) {
      warnedMissing = true;
      logger.warn(
        "REDIS_URL não definido — fila em memória apenas fora de produção (não durable).",
      );
    }
    return null;
  }
  return opts;
}

export async function pingRedis() {
  if (!isRedisConfigured()) {
    return { ok: false, configured: false };
  }

  try {
    const IORedis = (await import("ioredis")).default;
    const client = new IORedis(config.redis.url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      return { ok: pong === "PONG", configured: true };
    } finally {
      client.disconnect();
    }
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: safeRedisError(err),
    };
  }
}

/**
 * Produção não sobe sem Redis alcançável. Não imprime a URL.
 */
export async function assertRedisReachableInProduction() {
  if ((process.env.NODE_ENV || "development") !== "production") return;

  if (!isRedisConfigured()) {
    console.error("Redis é obrigatório em produção.");
    process.exit(1);
  }

  const ping = await pingRedis();
  if (!ping.ok) {
    console.error(
      "Redis é obrigatório em produção. Não foi possível conectar.",
    );
    process.exit(1);
  }
}

/** Processo de worker não tem fallback em memória. */
export async function assertRedisForWorker() {
  const production = (process.env.NODE_ENV || "development") === "production";
  if (!isRedisConfigured()) {
    console.error(
      production
        ? "Redis é obrigatório em produção."
        : "REDIS_URL é obrigatório para o worker.",
    );
    process.exit(1);
  }
  const ping = await pingRedis();
  if (!ping.ok) {
    console.error(
      production
        ? "Redis é obrigatório em produção. Não foi possível conectar."
        : "Não foi possível conectar ao Redis do worker.",
    );
    process.exit(1);
  }
}
