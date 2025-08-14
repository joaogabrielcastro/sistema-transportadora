// backend/src/routes/caminhoesRoutes.js
import { Router } from 'express';
import { caminhoesController } from '../controllers/caminhoesController.js';

const router = Router();

router.post('/', caminhoesController.createCaminhao);
router.get('/', caminhoesController.getAllCaminhoes);
router.get('/:placa', caminhoesController.getByPlaca);
router.put('/:placa', caminhoesController.updateCaminhao);
router.delete('/:placa', caminhoesController.deleteCaminhao);

export default router;