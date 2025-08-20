// backend/src/app.js
import express from "express";
import cors from "cors";

// Importa todas as rotas
import caminhoesRoutes from "./routes/caminhoesRoutes.js";
import pneusRoutes from "./routes/pneusRoutes.js";
import posicoesPneusRoutes from "./routes/posicoesPneusRoutes.js";
import statusPneusRoutes from "./routes/statusPneusRoutes.js";
import gastosRoutes from "./routes/gastosRoutes.js";
import checklistRoutes from "./routes/checklistRoutes.js";
import itensChecklistRoutes from "./routes/itensChecklistRoutes.js";
import tiposGastosRoutes from "./routes/tiposGastosRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Define as rotas
app.use("/api/caminhoes", caminhoesRoutes);
app.use("/api/pneus", pneusRoutes);
app.use("/api/posicoes-pneus", posicoesPneusRoutes);
app.use("/api/status-pneus", statusPneusRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/itens-checklist", itensChecklistRoutes);
app.use("/api/tipos-gastos", tiposGastosRoutes);

app.get("/", (req, res) => {
  res.send("API do Sistema de Transportadora está funcionando!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Ocorreu um erro no servidor!");
});

export default app;
