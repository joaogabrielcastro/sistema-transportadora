import { Router } from "express";
import { gastosController } from "../controllers/gastosController.js";

const router = Router();

// Rotas existentes
router.post("/", gastosController.createGasto);
router.get("/", gastosController.getAllGastos);
router.get("/caminhao/:id", gastosController.getGastosByCaminhao);
// Nova rota para o consumo de combustível
router.get("/consumo/:id", gastosController.getConsumoCombustivel);
router.get("/:id", gastosController.getGastoById);
router.put("/:id", gastosController.updateGasto);
router.delete("/:id", gastosController.deleteGasto);

export default router;
