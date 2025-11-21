// backend/src/routes/checklistRoutes.js
import { Router } from "express";
import { checklistController } from "../controllers/checklistController.js";

const router = Router();

router.post("/", checklistController.createChecklist);
router.get("/", checklistController.getAllChecklists);
router.get("/caminhao/:id", checklistController.getChecklistsByCaminhao);
router.get("/:id", checklistController.getChecklistById);

router.put("/:id", checklistController.updateChecklist);
router.delete("/:id", checklistController.deleteChecklist);

export default router;
