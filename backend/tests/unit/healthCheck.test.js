import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthPayload } from "../../src/utils/healthCheck.js";

test("buildHealthPayload retorna healthy quando todas as probes ok", () => {
  const payload = buildHealthPayload({
    dbOk: true,
    pdfReady: true,
    uploadsWritable: true,
    uploadsDetail: { writable: true },
    redisOk: true,
    redisConfigured: true,
    queueMode: "redis",
    uptime: 10,
    isProd: true,
  });

  assert.equal(payload.status, "healthy");
  assert.deepEqual(payload.issues, []);
  assert.equal(payload.database.ok, true);
  assert.equal(payload.redis.ok, true);
  assert.equal(payload.redis.queueMode, "redis");
  assert.equal(payload.mail.configured, false);
  assert.equal(payload.sentry.configured, false);
});

test("buildHealthPayload retorna degraded quando banco falha", () => {
  const payload = buildHealthPayload({
    dbOk: false,
    pdfReady: true,
    uploadsWritable: true,
    uploadsDetail: { writable: true },
    redisOk: true,
    redisConfigured: true,
    queueMode: "redis",
    uptime: 10,
    isProd: true,
  });

  assert.equal(payload.status, "degraded");
  assert.ok(payload.issues.includes("database"));
});

test("buildHealthPayload lista múltiplos problemas incluindo redis", () => {
  const payload = buildHealthPayload({
    dbOk: false,
    pdfReady: false,
    uploadsWritable: false,
    uploadsDetail: { writable: false },
    redisOk: false,
    redisConfigured: true,
    queueMode: "redis",
    uptime: 1,
    isProd: false,
  });

  assert.equal(payload.status, "degraded");
  assert.deepEqual(payload.issues, ["database", "pdf", "uploads", "redis"]);
});

test("buildHealthPayload ignora redis quando não configurado", () => {
  const payload = buildHealthPayload({
    dbOk: true,
    pdfReady: true,
    uploadsWritable: true,
    uploadsDetail: { writable: true },
    redisOk: false,
    redisConfigured: false,
    queueMode: "memory",
    uptime: 1,
    isProd: true,
  });

  assert.equal(payload.status, "healthy");
  assert.equal(payload.redis.ok, null);
  assert.equal(payload.redis.queueMode, "memory");
});
