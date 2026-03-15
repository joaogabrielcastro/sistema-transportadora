import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { config } from "../config/index.js";

const globalForPrisma = globalThis;
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida.");
}

const resolveSslConfig = () => {
  const mode = (config.database.sslMode || "auto").toLowerCase();

  if (mode === "disable") {
    return false;
  }

  if (mode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  if (mode === "require") {
    return { rejectUnauthorized: true };
  }

  if (connectionString.includes("supabase.co")) {
    return { rejectUnauthorized: false };
  }

  return false;
};

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString,
    ssl: resolveSslConfig(),
  });

const adapter = new PrismaPg(pool);

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}

export default prisma;