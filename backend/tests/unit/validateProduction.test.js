import test from "node:test";
import assert from "node:assert/strict";
import {
  getProductionConfigErrors,
  getProductionConfigWarnings,
} from "../../src/config/validateProduction.js";

const productionConfig = {
  app: { env: "production" },
  auth: {
    enabled: false,
    jwtSecret: "curto",
    apiToken: null,
  },
  database: { url: "", sslMode: "disable" },
  redis: { url: null },
};

const validProductionConfig = {
  app: { env: "production" },
  auth: {
    enabled: true,
    jwtSecret: "production-secret-ok-min-16",
    apiToken: null,
  },
  database: { url: "postgresql://localhost/db", sslMode: "disable" },
  redis: { url: "redis://localhost:6379/0" },
  storage: { s3Enabled: false },
  workers: { runInApiProcess: true },
};

test("getProductionConfigErrors retorna vazio fora de produção", () => {
  assert.deepEqual(
    getProductionConfigErrors({ app: { env: "test" } }),
    [],
  );
});

test("getProductionConfigErrors exige AUTH e JWT em produção", () => {
  const savedCors = process.env.CORS_ORIGINS;
  delete process.env.CORS_ORIGINS;

  try {
    const errors = getProductionConfigErrors(productionConfig);
    assert.ok(errors.some((e) => e.includes("AUTH_ENABLED")));
    assert.ok(errors.some((e) => e.includes("JWT_SECRET")));
    assert.ok(errors.some((e) => e.includes("DATABASE_URL")));
    assert.ok(errors.some((e) => e.includes("CORS_ORIGINS")));
    assert.ok(errors.some((e) => e.includes("REDIS_URL")));
  } finally {
    if (savedCors !== undefined) {
      process.env.CORS_ORIGINS = savedCors;
    }
  }
});

test("getProductionConfigWarnings alerta API_TOKEN, SSL e S3", () => {
  const warnings = getProductionConfigWarnings(validProductionConfig);
  assert.ok(warnings.some((w) => w.includes("API_TOKEN")));
  assert.ok(warnings.some((w) => w.includes("DB_SSL_MODE")));
  assert.ok(warnings.some((w) => w.includes("S3")));
});
