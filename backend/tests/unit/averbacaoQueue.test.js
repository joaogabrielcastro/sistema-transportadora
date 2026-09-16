import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enqueueAverbacaoJob } from "../../src/queues/averbacaoJobQueue.js";

describe("fila de averbação", () => {
  it("em produção recusa fallback em memória se Redis não estiver disponível", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedRedis = process.env.REDIS_URL;
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;
    try {
      await assert.rejects(
        () => enqueueAverbacaoJob(1, 1),
        (e) => e.statusCode === 503 && /Redis/i.test(e.message),
      );
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedRedis !== undefined) process.env.REDIS_URL = savedRedis;
      else delete process.env.REDIS_URL;
    }
  });
});
