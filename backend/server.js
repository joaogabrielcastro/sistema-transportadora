// backend/src/server.js
/* eslint-disable no-undef */

console.log("=== URL DO BANCO QUE O NODE ESTA VENDO ===", process.env.DATABASE_URL);

import app from "./src/app.js";

const PORT = process.env.PORT || 3011;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
