import { Router } from 'express';
import { gastosController } from '../controllers/gastosController.js';

const router = Router();

// Rotas existentes
router.post('/', gastosController.createGasto);
router.get('/', gastosController.getAllGastos);
router.get('/:id', gastosController.getGastoById);
router.get('/caminhao/:caminhaoId', gastosController.getGastosByCaminhaoId);
router.put('/:id', gastosController.updateGasto);
router.delete('/:id', gastosController.deleteGasto);

// Nova rota para o consumo de combustível
router.get('/consumo/:id', gastosController.getConsumoCombustivel);

export default router;