import "dotenv/config";

import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pgPkg from "pg";

const { PrismaClient } = prismaClientPkg;
const { Pool } = pgPkg;

const globalForPrisma = globalThis;

const databaseUrl = process.env.DATABASE_URL || "";
// Seu Postgres não suporta TLS.
// Para evitar qualquer comportamento inesperado do `pg`, removemos `sslmode`
// da connection string e forçamos `ssl: false`.
let cleanDatabaseUrl = databaseUrl;
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

const ssl = false;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: cleanDatabaseUrl,
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