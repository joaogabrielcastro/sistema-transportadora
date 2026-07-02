// backend/src/server.js
/* eslint-disable no-undef */

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

const { validateProductionConfig } = await import(
  "./src/config/validateProduction.js"
);
validateProductionConfig();

const { default: app } = await import("./src/app.js");

const PORT = process.env.PORT || 3020;

app.listen(PORT, async () => {
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
