import "dotenv/config";

import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pgPkg from "pg";

const { PrismaClient } = prismaClientPkg;
const { Pool } = pgPkg;

const globalForPrisma = globalThis;

const databaseUrl = (process.env.DATABASE_URL || "")
  .trim()
  .replace(/^["']|["']$/g, "");

function resolvePgSsl() {
  const mode = String(process.env.DB_SSL_MODE || "auto")
    .trim()
    .toLowerCase();

  if (["disable", "false", "off", "0"].includes(mode)) {
    return false;
  }

  if (["require", "true", "on", "1", "enable"].includes(mode)) {
    return { rejectUnauthorized: false };
  }

  if (["verify", "strict"].includes(mode)) {
    return { rejectUnauthorized: true };
  }

  // auto: respeita sslmode na URL ou hosts gerenciados comuns
  if (/sslmode=(require|verify-full|verify-ca|prefer)/i.test(databaseUrl)) {
    return { rejectUnauthorized: false };
  }

  return false;
}

const ssl = resolvePgSsl();

function positiveInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * max 10 é o default do node-pg, agora explícito.
 * API + worker = até 20 conexões, abaixo do max_connections padrão do Postgres (100).
 * connectionTimeoutMillis 5s troca o default 0 (espera infinita) para falhar se o banco não responde.
 * Capacidade do VPS não foi medida; estes números não são um tuning de produção.
 */
const poolMax = positiveInt("DB_POOL_MAX", 10);

let cleanDatabaseUrl = databaseUrl;
if (!ssl) {
  try {
    const u = new URL(databaseUrl);
    u.searchParams.delete("sslmode");
    cleanDatabaseUrl = u.toString();
  } catch {
    cleanDatabaseUrl = databaseUrl
      .replace(/([?&])sslmode=[^&]*/i, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: cleanDatabaseUrl,
        ssl,
        max: poolMax,
        connectionTimeoutMillis: positiveInt("DB_POOL_CONNECTION_TIMEOUT_MS", 5000),
        idleTimeoutMillis: positiveInt("DB_POOL_IDLE_TIMEOUT_MS", 10000),
      }),
    ),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
