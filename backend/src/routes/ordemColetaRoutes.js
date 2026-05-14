import express from "express";
import { ordemColetaController } from "../controllers/ordemColetaController.js";

const router = express.Router();

router.get("/historico", ordemColetaController.historico);
router.post("/preview", ordemColetaController.preview);
router.post("/pdf", ordemColetaController.pdf);
router.post("/enviar", ordemColetaController.enviar);

export default router;
