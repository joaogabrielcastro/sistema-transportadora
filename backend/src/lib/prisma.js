import "dotenv/config";

import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pgPkg from "pg";

const { PrismaClient } = prismaClientPkg;
const { Pool } = pgPkg;

const globalForPrisma = globalThis;

const databaseUrl = process.env.DATABASE_URL || "";
const dbSslMode = (process.env.DB_SSL_MODE || "").toLowerCase();

// Mapeia DB_SSL_MODE -> configuração `ssl` do `pg`.
// IMPORTANTE: se a DATABASE_URL indicar sslmode=disable (ou o typo "desable"),
// nós *forçamos* ssl=false, porque seu Postgres não suporta TLS.
let ssl;

// Override forte baseado na URL.
if (/sslmode=disable/i.test(databaseUrl) || /sslmode=desable/i.test(databaseUrl)) {
  ssl = false;
} else if (/sslmode=require/i.test(databaseUrl)) {
  ssl = { rejectUnauthorized: true };
} else if (dbSslMode === "disable") {
  ssl = false;
} else if (dbSslMode === "no-verify") {
  ssl = { rejectUnauthorized: false };
} else if (dbSslMode === "require") {
  ssl = { rejectUnauthorized: true };
} else {
  ssl = undefined;
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: databaseUrl,
        ssl,
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