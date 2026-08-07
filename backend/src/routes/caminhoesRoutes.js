// backend/src/routes/caminhoesRoutes.js
import { Router } from "express";
import { caminhoesController } from "../controllers/caminhoesController.js";
import {
  caminhaoDocumentosController,
  loadCaminhaoForUpload,
} from "../controllers/caminhaoDocumentosController.js";
import {
  uploadCaminhaoPdfs,
  handleMulterError,
} from "../middleware/uploadCaminhaoPdf.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/search",
  requirePermission(PERMISSIONS.FROTA_READ),
  caminhoesController.searchCaminhoes,
);
router.post(
  "/",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.createCaminhao,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.FROTA_READ),
  caminhoesController.getAllCaminhoes,
);
router.delete(
  "/:placa/cascade",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.deleteCaminhaoWithCascade,
);
router.get(
  "/:placa/check-dependencies",
  requirePermission(PERMISSIONS.FROTA_READ),
  caminhoesController.checkDependencies,
);

router.get(
  "/:placa/documentos",
  requirePermission(PERMISSIONS.DOCS_READ),
  caminhaoDocumentosController.listar,
);
const runUploadCaminhaoPdfs = (req, res, next) => {
  uploadCaminhaoPdfs(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
};

router.post(
  "/:placa/documentos",
  requirePermission(PERMISSIONS.DOCS_WRITE),
  loadCaminhaoForUpload,
  runUploadCaminhaoPdfs,
  caminhaoDocumentosController.upload,
);
router.get(
  "/:placa/documentos/:docId/arquivo",
  requirePermission(PERMISSIONS.DOCS_READ),
  caminhaoDocumentosController.download,
);
router.patch(
  "/:placa/documentos/:docId",
  requirePermission(PERMISSIONS.DOCS_WRITE),
  caminhaoDocumentosController.patchMeta,
);
router.delete(
  "/:placa/documentos/:docId",
  requirePermission(PERMISSIONS.DOCS_WRITE),
  caminhaoDocumentosController.remover,
);

router.put(
  "/id/:id",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.updateCaminhaoById,
);
router.get(
  "/id/:id/vinculos",
  requirePermission(PERMISSIONS.FROTA_READ),
  caminhoesController.listarVinculos,
);
router.post(
  "/id/:id/vinculos",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.vincularCarreta,
);
router.delete(
  "/id/:id/vinculos/:vinculoId",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.desvincularCarreta,
);
router.get(
  "/:placa",
  requirePermission(PERMISSIONS.FROTA_READ),
  caminhoesController.getByPlaca,
);
router.put(
  "/:placa",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.updateCaminhao,
);
router.delete(
  "/:placa",
  requirePermission(PERMISSIONS.FROTA_WRITE),
  caminhoesController.deleteCaminhao,
);

export default router;
