import { Router } from "express";
import multer from "multer";
import { notasFiscaisController } from "../controllers/notasFiscaisController.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 4 },
});

const router = Router();

router.use(requireFeature("notas_estoque"));

router.get(
  "/",
  requirePermission(PERMISSIONS.NOTAS_READ),
  notasFiscaisController.listar,
);
router.get(
  "/produtos",
  requirePermission(PERMISSIONS.NOTAS_READ),
  notasFiscaisController.listarProdutos,
);
router.get(
  "/movimentos",
  requirePermission(PERMISSIONS.NOTAS_READ),
  notasFiscaisController.listarMovimentos,
);
router.post(
  "/estoque/baixa",
  requirePermission(PERMISSIONS.NOTAS_WRITE),
  notasFiscaisController.baixarEstoque,
);
router.post(
  "/preview",
  requirePermission(PERMISSIONS.NOTAS_WRITE),
  upload.single("xml"),
  notasFiscaisController.preview,
);
router.post(
  "/importar",
  requirePermission(PERMISSIONS.NOTAS_WRITE),
  upload.fields([
    { name: "xml", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]),
  notasFiscaisController.importar,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.NOTAS_READ),
  notasFiscaisController.getById,
);

export default router;
