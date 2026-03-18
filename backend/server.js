// backend/src/server.js
/* eslint-disable no-undef */

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";

const { default: app } = await import("./src/app.js");

const PORT = process.env.PORT || 3011;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
