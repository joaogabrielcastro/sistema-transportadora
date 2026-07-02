import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import {
  apiRateLimiter,
  attachRequestContext,
  auditLog,
  requireAuth,
} from "./middleware/security.js";
import caminhoesRoutes from "./routes/caminhoesRoutes.js";
import pneusRoutes from "./routes/pneusRoutes.js";
import posicoesPneusRoutes from "./routes/posicoesPneusRoutes.js";
import statusPneusRoutes from "./routes/statusPneusRoutes.js";
import gastosRoutes from "./routes/gastosRoutes.js";
import checklistRoutes from "./routes/checklistRoutes.js";
import itensChecklistRoutes from "./routes/itensChecklistRoutes.js";
import tiposGastosRoutes from "./routes/tiposGastosRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import ordemColetaRoutes from "./routes/ordemColetaRoutes.js";
import { ensureUploadDirs } from "./utils/uploadPaths.js";
import { runHealthCheck } from "./utils/healthCheck.js";

ensureUploadDirs();

const app = express();

// Necessário em ambientes atrás de proxy/reverse-proxy (Coolify/Caddy/Nginx)
app.set("trust proxy", config.app.trustProxy);

// Middleware de segurança
app.use(helmet());
app.use(attachRequestContext);

// CORS configurado via config
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.app.corsOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// Middleware para parsing JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de logging estruturado
app.use((req, res, next) => {
  logger.info("Request received", {
    requestId: req.context?.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Rate limit, auth e auditoria só na API (health check livre para monitoramento)
app.use("/api", apiRateLimiter, requireAuth, auditLog);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API do Sistema de Transportadora está funcionando!",
    version: "1.0.0",
    environment: config.app.env,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", async (req, res) => {
  const { httpStatus, payload } = await runHealthCheck();
  res.status(httpStatus).json(payload);
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
app.use("/api/reports", reportsRoutes);
app.use("/api/ordem-coleta", ordemColetaRoutes);

// Middleware de tratamento de rotas não encontradas
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

export default app;
