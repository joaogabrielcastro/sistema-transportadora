/* global process, console */
import "dotenv/config";

const caseId = process.env.TEST_CASE || "1";

// Simula os cenários que estavam falhando no deploy.
// Importante: ajustamos env antes de importar o prisma.js, para garantir que o adapter pg receba a configuração correta.
if (caseId === "1") {
  process.env.DB_SSL_MODE = "require";
  // Mantém o sslmode da DATABASE_URL vindo do .env local (normalmente sslmode=disable).
} else if (caseId === "2") {
  process.env.DB_SSL_MODE = "require";
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /sslmode=disable/i,
    "sslmode=desable",
  );
} else if (caseId === "3") {
  process.env.DB_SSL_MODE = "require";
  // Remove o parâmetro sslmode da URL (caso em que o comportamento vira 100% dependente do DB_SSL_MODE).
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\?sslmode=[^&]*/i,
    "",
  );
}

const { default: prisma } = await import("../src/lib/prisma.js");

try {
  const count = await prisma.caminhoes.count();
  console.log(`[TLS_TEST case=${caseId}] OK count=${count}`);
} catch (err) {
  console.error(
    `[TLS_TEST case=${caseId}] ERROR ${err?.name || "Error"}: ${err?.message || err}`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

