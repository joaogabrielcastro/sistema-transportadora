// backend/src/app.js (arquivo principal)
import express from "express";
import { supabase } from "./config/supabase.js";
import caminhoesRoutes from "./routes/caminhoesRoutes.js";
import gastosRoutes from "./routes/gastosRoutes.js";
import pneusRoutes from "./routes/pneusRoutes.js";
import posicoesPneusRoutes from "./routes/posicoesPneusRoutes.js";
import statusPneusRoutes from "./routes/statusPneusRoutes.js";
import tiposGastosRoutes from "./routes/tiposGastosRoutes.js";
import checklistRoutes from "./routes/checklistRoutes.js";
import itensChecklistRoutes from "./routes/itensChecklistRoutes.js";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Rotas da API
app.use("/api/caminhoes", caminhoesRoutes);
app.use("/api/posicoes-pneus", posicoesPneusRoutes);
app.use("/api/status-pneus", statusPneusRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/pneus", pneusRoutes);
app.use("/api/tipos-gastos", tiposGastosRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/itens-checklist", itensChecklistRoutes);

app.get("/", (req, res) => {
  res.send("API da Transportadora em execução!");
});

export default app;
