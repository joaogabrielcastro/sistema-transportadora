import { Router } from "express";
import { motoristasController } from "../controllers/motoristasController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.MOTORISTAS_READ),
  motoristasController.list,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.MOTORISTAS_READ),
  motoristasController.get,
);
router.post(
  "/",
  requirePermission(PERMISSIONS.MOTORISTAS_WRITE),
  motoristasController.create,
);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.MOTORISTAS_WRITE),
  motoristasController.update,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.MOTORISTAS_WRITE),
  motoristasController.remove,
);

export default router;
