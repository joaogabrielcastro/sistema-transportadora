// backend/src/routes/pneusRoutes.js
import { Router } from 'express';
import { pneusController } from '../controllers/pneusController.js';

const router = Router();

router.post('/', pneusController.createPneu);
router.get('/', pneusController.getAllPneus);
router.get('/:id', pneusController.getPneuById);
router.get('/caminhao/:caminhaoId', pneusController.getPneusByCaminhaoId);
router.put('/:id', pneusController.updatePneu);
router.delete('/:id', pneusController.deletePneu);
router.get('/alertas', pneusController.getAlertaPneus);

export default router;