import { Router } from "express";
import { reportsController } from "../controllers/reportsController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/overview",
  requirePermission(PERMISSIONS.REPORTS_READ),
  reportsController.getOverview,
);
router.get(
  "/cost-per-km",
  requirePermission(PERMISSIONS.REPORTS_READ),
  reportsController.getCostPerKm,
);
router.get(
  "/cost-per-km-trend",
  requirePermission(PERMISSIONS.REPORTS_READ),
  reportsController.getCostPerKmTrend,
);

export default router;
