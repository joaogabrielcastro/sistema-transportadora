import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.AUTH_ENABLED = "true";
process.env.API_TOKEN = "integration-test-token-ok";
process.env.JWT_SECRET = "integration-test-jwt-secret-ok";
process.env.ADMIN_EMAIL = "test-admin@abbroto.local";
process.env.ADMIN_PASSWORD = "TestAdmin123456!";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.MAIL_FROM = "test@abbroto.local";
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || "200";
process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), "abbroto-uploads-"));

export const shouldRunDbTests =
  process.env.CI === "true" || process.env.RUN_DB_TESTS === "1";
