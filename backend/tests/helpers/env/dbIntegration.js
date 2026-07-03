import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.AUTH_ENABLED = "false";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.MAIL_FROM = "test@abbroto.local";
process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), "abbroto-uploads-"));

/** Só roda testes com Postgres em CI ou com RUN_DB_TESTS=1. */
export const shouldRunDbTests =
  process.env.CI === "true" || process.env.RUN_DB_TESTS === "1";
