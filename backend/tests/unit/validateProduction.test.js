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
};

const validProductionConfig = {
  app: { env: "production" },
  auth: {
    enabled: true,
    jwtSecret: "production-secret-ok-min-16",
    apiToken: null,
  },
  database: { url: "postgresql://localhost/db", sslMode: "disable" },
  redis: { url: null },
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
  } finally {
    if (savedCors !== undefined) {
      process.env.CORS_ORIGINS = savedCors;
    }
  }
});

test("getProductionConfigWarnings alerta API_TOKEN, SSL e REDIS", () => {
  const warnings = getProductionConfigWarnings(validProductionConfig);
  assert.ok(warnings.some((w) => w.includes("API_TOKEN")));
  assert.ok(warnings.some((w) => w.includes("DB_SSL_MODE")));
  assert.ok(warnings.some((w) => w.includes("REDIS_URL")));
});
