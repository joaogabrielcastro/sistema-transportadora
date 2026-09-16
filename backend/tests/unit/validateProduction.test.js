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
  const savedAmbiente = process.env.BRASIL_NFE_AMBIENTE;
  const savedSecrets = process.env.FISCAL_SECRETS_KEY;
  const savedUserToken = process.env.BRASIL_NFE_USER_TOKEN;
  delete process.env.CORS_ORIGINS;
  delete process.env.BRASIL_NFE_AMBIENTE;
  delete process.env.FISCAL_SECRETS_KEY;
  delete process.env.BRASIL_NFE_USER_TOKEN;

  try {
    const errors = getProductionConfigErrors(productionConfig);
    assert.ok(errors.some((e) => e.includes("AUTH_ENABLED")));
    assert.ok(errors.some((e) => e.includes("JWT_SECRET")));
    assert.ok(errors.some((e) => e.includes("DATABASE_URL")));
    assert.ok(errors.some((e) => e.includes("CORS_ORIGINS")));
    assert.ok(errors.some((e) => e.includes("REDIS_URL")));
    assert.ok(errors.some((e) => e.includes("FISCAL_SECRETS_KEY")));
    assert.ok(errors.some((e) => e.includes("BRASIL_NFE_AMBIENTE")));
    assert.ok(errors.some((e) => e.includes("BRASIL_NFE_USER_TOKEN")));
  } finally {
    if (savedCors !== undefined) process.env.CORS_ORIGINS = savedCors;
    else delete process.env.CORS_ORIGINS;
    if (savedAmbiente !== undefined) process.env.BRASIL_NFE_AMBIENTE = savedAmbiente;
    else delete process.env.BRASIL_NFE_AMBIENTE;
    if (savedSecrets !== undefined) process.env.FISCAL_SECRETS_KEY = savedSecrets;
    else delete process.env.FISCAL_SECRETS_KEY;
    if (savedUserToken !== undefined) process.env.BRASIL_NFE_USER_TOKEN = savedUserToken;
    else delete process.env.BRASIL_NFE_USER_TOKEN;
  }
});

test("getProductionConfigWarnings alerta API_TOKEN, SSL e S3", () => {
  const warnings = getProductionConfigWarnings(validProductionConfig);
  assert.ok(warnings.some((w) => w.includes("API_TOKEN")));
  assert.ok(warnings.some((w) => w.includes("DB_SSL_MODE")));
  assert.ok(warnings.some((w) => w.includes("S3")));
  assert.ok(warnings.some((w) => w.includes("Worker de PDF rodando na API")));
});

test("getProductionConfigWarnings alerta worker desligado na API", () => {
  const warnings = getProductionConfigWarnings({
    ...validProductionConfig,
    workers: { runInApiProcess: false },
  });
  assert.ok(
    warnings.some((w) => w.includes("DESLIGADO") || w.includes("Processando")),
  );
});

test("getProductionConfigWarnings alerta SMTP, Sentry e backup", () => {
  const savedSentry = process.env.SENTRY_DSN;
  const savedBackup = process.env.BACKUP_ENABLED;
  delete process.env.SENTRY_DSN;
  delete process.env.BACKUP_ENABLED;
  try {
    const warnings = getProductionConfigWarnings({
      ...validProductionConfig,
      mail: { smtpHost: "", smtpPort: 0, mailFrom: "" },
    });
    assert.ok(warnings.some((w) => w.includes("SMTP")));
    assert.ok(warnings.some((w) => w.includes("SENTRY_DSN")));
    assert.ok(warnings.some((w) => w.includes("BACKUP_ENABLED")));
  } finally {
    if (savedSentry !== undefined) process.env.SENTRY_DSN = savedSentry;
    else delete process.env.SENTRY_DSN;
    if (savedBackup !== undefined) process.env.BACKUP_ENABLED = savedBackup;
    else delete process.env.BACKUP_ENABLED;
  }
});

test("produção fiscal exige BRASIL_NFE_AMBIENTE=1, secrets e UserToken", () => {
  const saved = {
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    BRASIL_NFE_AMBIENTE: process.env.BRASIL_NFE_AMBIENTE,
    FISCAL_SECRETS_KEY: process.env.FISCAL_SECRETS_KEY,
    BRASIL_NFE_USER_TOKEN: process.env.BRASIL_NFE_USER_TOKEN,
  };
  process.env.CORS_ORIGINS = "https://app.example.com";
  delete process.env.BRASIL_NFE_AMBIENTE;
  delete process.env.FISCAL_SECRETS_KEY;
  delete process.env.BRASIL_NFE_USER_TOKEN;
  try {
    const missing = getProductionConfigErrors({
      ...validProductionConfig,
      fiscal: { ambiente: 2, secretsKey: "", brasilNfeUserToken: "" },
    });
    assert.ok(missing.some((e) => e.includes("BRASIL_NFE_AMBIENTE")));
    assert.ok(missing.some((e) => e.includes("FISCAL_SECRETS_KEY")));
    assert.ok(missing.some((e) => e.includes("BRASIL_NFE_USER_TOKEN")));

    process.env.BRASIL_NFE_AMBIENTE = "1";
    process.env.FISCAL_SECRETS_KEY = "unit-test-fiscal-secrets-key";
    process.env.BRASIL_NFE_USER_TOKEN = "user-token-prod";
    const ok = getProductionConfigErrors({
      ...validProductionConfig,
      fiscal: {
        ambiente: 1,
        secretsKey: "unit-test-fiscal-secrets-key",
        brasilNfeUserToken: "user-token-prod",
      },
    });
    assert.equal(ok.length, 0);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  }
});
