import { Router } from "express";
import rateLimit from "express-rate-limit";
import { telemetryController } from "../controllers/telemetryController.js";

const router = Router();

router.post(
  "/ingest",
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.TELEMETRY_INGEST_RATE_LIMIT_MAX || 10_000),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Muitos eventos de telemetria. Aguarde um instante.",
    },
  }),
  telemetryController.ingest,
);

export default router;
