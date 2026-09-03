import { Router } from "express";
import { usersController } from "../controllers/usersController.js";
import { requireRole } from "../middleware/security.js";

const router = Router();

router.use(requireRole("admin"));
router.get("/", usersController.list);
router.post("/invite", usersController.invite);
router.post("/", usersController.create);
router.patch("/:id", usersController.update);

export default router;
