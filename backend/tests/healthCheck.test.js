import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthPayload } from "../src/utils/healthCheck.js";

test("buildHealthPayload retorna healthy quando todas as probes ok", () => {
  const payload = buildHealthPayload({
    dbOk: true,
    pdfReady: true,
    uploadsWritable: true,
    uploadsDetail: { writable: true },
    uptime: 10,
    isProd: true,
  });

  assert.equal(payload.status, "healthy");
  assert.deepEqual(payload.issues, []);
  assert.equal(payload.database.ok, true);
});

test("buildHealthPayload retorna degraded quando banco falha", () => {
  const payload = buildHealthPayload({
    dbOk: false,
    pdfReady: true,
    uploadsWritable: true,
    uploadsDetail: { writable: true },
    uptime: 10,
    isProd: true,
  });

  assert.equal(payload.status, "degraded");
  assert.ok(payload.issues.includes("database"));
});

test("buildHealthPayload lista múltiplos problemas", () => {
  const payload = buildHealthPayload({
    dbOk: false,
    pdfReady: false,
    uploadsWritable: false,
    uploadsDetail: { writable: false },
    uptime: 1,
    isProd: false,
  });

  assert.equal(payload.status, "degraded");
  assert.deepEqual(payload.issues, ["database", "pdf", "uploads"]);
});
