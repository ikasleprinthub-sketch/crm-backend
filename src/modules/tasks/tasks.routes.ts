import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './tasks.controller';

const router = Router();

router.use(protect);

// Tasks
router.get('/',    ctrl.getAll);
router.post('/',   requireManager, ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', requireAdmin, ctrl.remove);

// SOP Steps
router.patch('/:id/sop/:stepId', ctrl.toggleStep);

// Task activity log
router.get('/:id/activity', ctrl.getActivity);

export default router;
