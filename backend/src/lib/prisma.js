import "dotenv/config";
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

const globalForPrisma = globalThis;

// O motor nativo em Rust do Prisma gerencia as conexões automaticamente
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