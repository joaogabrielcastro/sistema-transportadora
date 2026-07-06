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
