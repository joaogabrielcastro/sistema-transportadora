import express from "express";
import { ordemColetaController } from "../controllers/ordemColetaController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

router.get(
  "/historico",
  requirePermission(PERMISSIONS.ORDEM_SEND),
  ordemColetaController.historico,
);
router.delete("/historico/falhas", ordemColetaController.excluirFalhas);
router.post(
  "/preview",
  requirePermission(PERMISSIONS.ORDEM_SEND),
  ordemColetaController.preview,
);
router.post(
  "/pdf",
  requirePermission(PERMISSIONS.ORDEM_SEND),
  ordemColetaController.pdf,
);
router.post(
  "/enviar",
  requirePermission(PERMISSIONS.ORDEM_SEND),
  ordemColetaController.enviar,
);
router.get(
  "/envio/:id",
  requirePermission(PERMISSIONS.ORDEM_SEND),
  ordemColetaController.statusEnvio,
);

export default router;
