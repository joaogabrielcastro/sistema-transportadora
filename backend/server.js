// backend/src/server.js
/* eslint-disable no-undef */

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

const { validateProductionConfig } = await import(
  "./src/config/validateProduction.js"
);
validateProductionConfig();

const { config } = await import("./src/config/index.js");
const { default: app } = await import("./src/app.js");

const PORT = Number(process.env.PORT) || Number(config.app.port) || 3020;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 15_000);

const server = app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  try {
    const { OrdemColetaService } = await import(
      "./src/services/OrdemColetaService.js"
    );
    const retomados = await OrdemColetaService.retomarEnviosPendentes();
    if (retomados > 0) {
      console.log(`Ordens de coleta retomadas: ${retomados}`);
    }
  } catch (err) {
    console.error("Falha ao retomar envios pendentes:", err?.message);
  }
});

const shutdown = (signal) => {
  console.log(`${signal} recebido — encerrando servidor…`);

  const forceExit = setTimeout(() => {
    console.error("Timeout no shutdown — encerrando processo.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close(() => {
    clearTimeout(forceExit);
    console.log("Servidor encerrado com sucesso.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { server };
