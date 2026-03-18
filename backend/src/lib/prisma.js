import "dotenv/config";

// Em alguns ambientes de deploy, o build/runtime pode acabar usando engine "client" por cache ou env faltando.
// Forçamos "library" para Node/Docker para evitar o erro de adapter/accelerateUrl.
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;