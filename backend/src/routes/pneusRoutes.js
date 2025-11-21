// backend/src/routes/pneusRoutes.js
import { Router } from "express";
import { pneusController } from "../controllers/pneusController.js";

const router = Router();

router.post("/", pneusController.createPneu);
router.post("/bulk", pneusController.createBulkPneus); // Nova rota
router.get("/", pneusController.getAllPneus);
router.get("/caminhao/:id", pneusController.getPneusByCaminhao);
router.get("/:id", pneusController.getPneuById);

router.put("/:id", pneusController.updatePneu);
router.delete("/:id", pneusController.deletePneu);

export default router;
