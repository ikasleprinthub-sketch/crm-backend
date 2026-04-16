import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './users.controller';

const router = Router();

router.use(authenticate);

router.get('/',                        ctrl.getAll);
router.get('/my-team',                 requireManager, ctrl.getMyTeam);
router.get('/:id',                     ctrl.getOne);
router.post('/',                       requireAdmin, ctrl.create);
router.put('/:id',                     ctrl.update);
router.patch('/:id/assign-manager',    requireAdmin, ctrl.assignManager);
router.delete('/:id',                  requireAdmin, ctrl.remove);

export default router;
