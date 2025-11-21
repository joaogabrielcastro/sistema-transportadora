// backend/src/routes/itensChecklistRoutes.js
import { Router } from 'express';
import { itensChecklistController } from '../controllers/itensChecklistController.js';

const router = Router();
router.get('/', itensChecklistController.getAllItens);
export default router;