import { Router } from 'express';
import { statusPneusController } from '../controllers/statusPneusController.js';

const router = Router();
router.get('/', statusPneusController.getAllStatus);
export default router;