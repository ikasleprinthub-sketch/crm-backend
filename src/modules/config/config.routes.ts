import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import * as ctrl from './config.controller';

const router = Router();

router.use(protect);
router.get('/', ctrl.getConfigs);
router.put('/', requireAdmin, ctrl.updateConfig);

export default router;
