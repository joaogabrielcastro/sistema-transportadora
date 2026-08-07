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
    const { config: appConfig } = await import("./src/config/index.js");
    if (appConfig.workers.runInApiProcess) {
      const { startOrdemColetaWorker } = await import(
        "./src/queues/ordemColetaJobQueue.js"
      );
      await startOrdemColetaWorker();
    } else {
      console.log(
        "Worker ordem-coleta desabilitado na API (use scripts/worker-ordem-coleta.mjs).",
      );
    }
  } catch (err) {
    console.error("Falha ao iniciar worker ordem coleta:", err?.message);
  }

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

const shutdown = async (signal) => {
  console.log(`${signal} recebido — encerrando servidor…`);

  const forceExit = setTimeout(() => {
    console.error("Timeout no shutdown — encerrando processo.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    const { closeOrdemColetaQueue } = await import(
      "./src/queues/ordemColetaJobQueue.js"
    );
    await closeOrdemColetaQueue();
  } catch (err) {
    console.error("Erro ao fechar fila ordem coleta:", err?.message);
  }

  server.close(() => {
    clearTimeout(forceExit);
    console.log("Servidor encerrado com sucesso.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

export { server };
