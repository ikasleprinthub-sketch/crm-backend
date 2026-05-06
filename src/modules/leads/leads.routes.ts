import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './leads.controller';

const router = Router();

router.use(protect);

router.get('/',                  requireManager, ctrl.getAll);
router.get('/:id',               ctrl.getOne);
router.post('/',                 requireManager, ctrl.create);
router.patch('/:id',             requireManager, ctrl.update);
router.post('/:id/convert',      requireManager, ctrl.convertToTask);
router.delete('/:id',            requireManager, ctrl.remove);

export default router;
