import { Router } from "express";
import { registrosController } from "../controllers/registrosController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.FROTA_READ),
  registrosController.list,
);

export default router;
