import { Router } from "express";
import { registrosController } from "../controllers/registrosController.js";

const router = Router();

router.get("/", registrosController.list);

export default router;
