// backend/src/routes/tiposGastosRoutes.js
import { Router } from 'express';
import { tiposGastosController } from '../controllers/tiposGastosController.js';

const router = Router();
router.get('/', tiposGastosController.getAllTipos);
export default router;