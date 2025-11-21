import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

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

// Middleware de segurança
app.use(helmet());

// CORS configurado via config
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || config.app.corsOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// Middleware para parsing JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de logging estruturado
app.use((req, res, next) => {
  logger.info("Request received", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API do Sistema de Transportadora está funcionando!",
    version: "1.0.0",
    environment: config.app.env,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Define as rotas da API
app.use("/api/caminhoes", caminhoesRoutes);
app.use("/api/pneus", pneusRoutes);
app.use("/api/posicoes-pneus", posicoesPneusRoutes);
app.use("/api/status-pneus", statusPneusRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/itens-checklist", itensChecklistRoutes);
app.use("/api/tipos-gastos", tiposGastosRoutes);

// Middleware de tratamento de rotas não encontradas
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

export default app;
