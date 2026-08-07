// backend/src/routes/pneusRoutes.js
import { Router } from "express";
import { pneusController } from "../controllers/pneusController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.PNEUS_WRITE),
  pneusController.createPneu,
);
router.post(
  "/bulk",
  requirePermission(PERMISSIONS.PNEUS_WRITE),
  pneusController.createBulkPneus,
);
router.post(
  "/stock/bulk",
  requirePermission(PERMISSIONS.PNEUS_WRITE),
  pneusController.createBulkStockPneus,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.FROTA_READ),
  pneusController.getAllPneus,
);
router.get(
  "/in-stock",
  requirePermission(PERMISSIONS.FROTA_READ),
  pneusController.getInStockPneus,
);
router.get(
  "/caminhao/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  pneusController.getPneusByCaminhao,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  pneusController.getPneuById,
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.PNEUS_WRITE),
  pneusController.updatePneu,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.PNEUS_WRITE),
  pneusController.deletePneu,
);

export default router;
