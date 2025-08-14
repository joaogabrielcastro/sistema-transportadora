import { Router } from 'express';
import { posicoesPneusController } from '../controllers/posicoesPneusController.js';

const router = Router();
router.get('/', posicoesPneusController.getAllPosicoes);
export default router;