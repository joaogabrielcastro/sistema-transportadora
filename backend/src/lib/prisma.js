import "dotenv/config";
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

const globalForPrisma = globalThis;

// Deixamos o motor nativo do Prisma assumir o controle total
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