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
  requireRole,
} from "./middleware/security.js";
import { authController } from "./controllers/authController.js";
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
import registrosRoutes from "./routes/registrosRoutes.js";
import { ensureUploadDirs } from "./utils/uploadPaths.js";
import { runHealthCheck } from "./utils/healthCheck.js";

ensureUploadDirs();

const app = express();

app.set("trust proxy", config.app.trustProxy);

app.use(helmet());
app.use(attachRequestContext);

const normalizeOrigin = (origin) =>
  String(origin || "")
    .trim()
    .replace(/\/$/, "");

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  return config.app.corsOrigins.some(
    (allowed) => normalizeOrigin(allowed) === normalized,
  );
};

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS origin rejeitada", {
          origin,
          allowedOrigins: config.app.corsOrigins,
        });
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

const apiRouter = express.Router();
apiRouter.use(apiRateLimiter);
apiRouter.post("/auth/login", authController.login);
apiRouter.use(requireAuth);
apiRouter.use(auditLog);
apiRouter.get("/auth/me", authController.me);
apiRouter.use("/caminhoes", caminhoesRoutes);
apiRouter.use("/pneus", pneusRoutes);
apiRouter.use("/posicoes-pneus", posicoesPneusRoutes);
apiRouter.use("/status-pneus", statusPneusRoutes);
apiRouter.use("/gastos", gastosRoutes);
apiRouter.use("/checklist", checklistRoutes);
apiRouter.use("/itens-checklist", itensChecklistRoutes);
apiRouter.use("/tipos-gastos", tiposGastosRoutes);
apiRouter.use("/reports", reportsRoutes);
apiRouter.use("/registros", registrosRoutes);
apiRouter.use(
  "/ordem-coleta",
  (req, res, next) => {
    if (req.method === "DELETE" && req.path === "/historico/falhas") {
      return requireRole("admin")(req, res, next);
    }
    return next();
  },
  ordemColetaRoutes,
);

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
