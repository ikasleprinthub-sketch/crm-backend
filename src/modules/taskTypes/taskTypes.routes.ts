import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import * as ctrl from './taskTypes.controller';

const router = Router();

router.use(authenticate);

router.get('/',             ctrl.getAll);
router.get('/:id',          ctrl.getOne);
router.post('/',            requireAdmin, ctrl.create);
router.put('/:id',          requireAdmin, ctrl.update);
router.patch('/:id/status', requireAdmin, ctrl.toggleStatus);
router.delete('/:id',       requireAdmin, ctrl.remove);

export default router;
