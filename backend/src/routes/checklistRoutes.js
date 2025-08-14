// backend/src/routes/checklistRoutes.js
import { Router } from 'express';
import { checklistController } from '../controllers/checklistController.js';

const router = Router();

router.post('/', checklistController.createChecklist);
router.get('/', checklistController.getAllChecklists);
router.get('/:id', checklistController.getChecklistById);
router.get('/caminhao/:caminhaoId', checklistController.getChecklistsByCaminhaoId);
router.put('/:id', checklistController.updateChecklist);
router.delete('/:id', checklistController.deleteChecklist);

export default router;