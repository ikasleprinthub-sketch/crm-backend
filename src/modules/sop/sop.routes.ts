import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import * as ctrl from './sop.controller';

const router = Router();

router.use(protect);

router.get('/:taskTypeId', ctrl.getTemplate);
router.post('/:taskTypeId', requireAdmin, ctrl.saveTemplate);

export default router;
