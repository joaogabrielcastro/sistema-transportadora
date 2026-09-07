import { Router } from "express";
import multer from "multer";
import { gastosController } from "../controllers/gastosController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

const router = Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  gastosController.createGasto,
);
router.post(
  "/preview-xml-combustivel",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  xmlUpload.single("xml"),
  gastosController.previewXmlCombustivel,
);
router.post(
  "/importar-xml-combustivel",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  xmlUpload.single("xml"),
  gastosController.importarXmlCombustivel,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.FROTA_READ),
  gastosController.getAllGastos,
);
router.get(
  "/caminhao/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  gastosController.getGastosByCaminhao,
);
router.get(
  "/consumo/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  gastosController.getConsumoCombustivel,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.FROTA_READ),
  gastosController.getGastoById,
);
router.put(
  "/:id",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  gastosController.updateGasto,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  gastosController.deleteGasto,
);

export default router;
