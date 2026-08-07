// backend/src/routes/checklistRoutes.js
import { Router } from "express";
import { checklistController } from "../controllers/checklistController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  checklistController.createChecklist,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.FROTA_READ),
  checklistController.getAllChecklists,
);
router.get(
  "/caminhao/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  checklistController.getChecklistsByCaminhao,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  checklistController.getChecklistById,
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  checklistController.updateChecklist,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  checklistController.deleteChecklist,
);

export default router;
