import { Router } from "express";
import { tenantController } from "../controllers/tenantController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/security.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  tenantController.getSettings,
);
router.patch(
  "/",
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  tenantController.updateSettings,
);
router.post("/close", requireRole("admin"), tenantController.closeAccount);

export default router;
