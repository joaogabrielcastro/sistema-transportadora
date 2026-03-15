import { Router } from "express";
import { reportsController } from "../controllers/reportsController.js";

const router = Router();

router.get("/overview", reportsController.getOverview);
router.get("/cost-per-km", reportsController.getCostPerKm);

export default router;
