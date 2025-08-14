// backend/src/routes/gastosRoutes.js
import { Router } from 'express';
import { gastosController } from '../controllers/gastosController.js';

const router = Router();

router.post('/', gastosController.createGasto);
router.get('/', gastosController.getAllGastos);
router.get('/:id', gastosController.getGastoById);
router.get('/caminhao/:caminhaoId', gastosController.getGastosByCaminhaoId);
router.put('/:id', gastosController.updateGasto);
router.delete('/:id', gastosController.deleteGasto);

export default router;