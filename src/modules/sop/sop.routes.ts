import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './sop.controller';

const router = Router();

router.use(authenticate);

// Templates
router.get('/',                        ctrl.getAll);
router.get('/:id',                     ctrl.getOne);
router.post('/',                       requireManager, ctrl.create);
router.put('/:id/steps',              requireManager, ctrl.updateSteps);
router.post('/:id/steps',             requireManager, ctrl.addStep);
router.delete('/:id/steps/:stepId',   requireManager, ctrl.deleteStep);
router.delete('/:id',                 requireAdmin,   ctrl.remove);

export default router;
