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

const router = Router();

router.get("/search", caminhoesController.searchCaminhoes);
router.post("/", caminhoesController.createCaminhao);
router.get("/", caminhoesController.getAllCaminhoes);
router.delete("/:placa/cascade", caminhoesController.deleteCaminhaoWithCascade);
router.get("/:placa/check-dependencies", caminhoesController.checkDependencies);

router.get("/:placa/documentos", caminhaoDocumentosController.listar);
const runUploadCaminhaoPdfs = (req, res, next) => {
  uploadCaminhaoPdfs(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
};

router.post(
  "/:placa/documentos",
  loadCaminhaoForUpload,
  runUploadCaminhaoPdfs,
  caminhaoDocumentosController.upload,
);
router.get(
  "/:placa/documentos/:docId/arquivo",
  caminhaoDocumentosController.download,
);
router.delete(
  "/:placa/documentos/:docId",
  caminhaoDocumentosController.remover,
);

// Atualizar por ID (útil para chamadas do frontend que possuem apenas o ID)
router.put("/id/:id", caminhoesController.updateCaminhaoById);
router.get("/:placa", caminhoesController.getByPlaca);
router.put("/:placa", caminhoesController.updateCaminhao);
router.delete("/:placa", caminhoesController.deleteCaminhao);

export default router;
