import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

let warnedMissing = false;

export function isRedisConfigured() {
  return Boolean(config.redis?.url);
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
        "REDIS_URL não definido — fila de ordem de coleta usa memória (não durable).",
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
      error: err?.message || String(err),
    };
  }
}
