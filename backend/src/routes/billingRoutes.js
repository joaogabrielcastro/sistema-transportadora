import { Router } from "express";
import { billingController } from "../controllers/billingController.js";
import { requireRole } from "../middleware/security.js";

const router = Router();

router.get("/status", billingController.status);
router.post("/checkout-session", requireRole("admin"), billingController.checkout);
router.post("/portal-session", requireRole("admin"), billingController.portal);

export default router;
