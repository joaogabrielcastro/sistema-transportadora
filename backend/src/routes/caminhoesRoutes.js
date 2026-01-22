// backend/src/routes/caminhoesRoutes.js
import { Router } from "express";
import { caminhoesController } from "../controllers/caminhoesController.js";

const router = Router();

router.get("/search", caminhoesController.searchCaminhoes);
router.post("/", caminhoesController.createCaminhao);
router.get("/", caminhoesController.getAllCaminhoes);
router.delete("/:placa/cascade", caminhoesController.deleteCaminhaoWithCascade);
// Atualizar por ID (útil para chamadas do frontend que possuem apenas o ID)
router.put("/id/:id", caminhoesController.updateCaminhaoById);
router.get("/:placa", caminhoesController.getByPlaca);
router.put("/:placa", caminhoesController.updateCaminhao);
router.delete("/:placa", caminhoesController.deleteCaminhao);
router.get("/:placa/check-dependencies", caminhoesController.checkDependencies);

export default router;
