// backend/src/server.js
/* eslint-disable no-undef */

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

const { validateProductionConfig } = await import(
  "./src/config/validateProduction.js"
);
validateProductionConfig();

const { initSentry } = await import("./src/lib/sentry.js");
await initSentry();

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
    const { ensureDefaultTiposGastos } = await import("./src/utils/tiposGastos.js");
    const novos = await ensureDefaultTiposGastos();
    if (novos > 0) {
      console.log(`Tipos de gasto padrão: ${novos} adicionado(s).`);
    }
  } catch (err) {
    console.error("Falha ao garantir tipos de gasto padrão:", err?.message);
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

  try {
    const { verifyMailOnBoot } = await import("./src/utils/mailer.js");
    await verifyMailOnBoot();
  } catch (err) {
    console.error("Falha ao verificar SMTP:", err?.message);
  }

  try {
    const { startBackupScheduler } = await import("./src/utils/backupDb.js");
    startBackupScheduler();
  } catch (err) {
    console.error("Falha ao agendar backup:", err?.message);
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

  try {
    const { stopBackupScheduler } = await import("./src/utils/backupDb.js");
    stopBackupScheduler();
  } catch (err) {
    console.error("Erro ao parar backup:", err?.message);
  }

  try {
    const { closeSentry } = await import("./src/lib/sentry.js");
    await closeSentry();
  } catch (err) {
    console.error("Erro ao fechar Sentry:", err?.message);
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
