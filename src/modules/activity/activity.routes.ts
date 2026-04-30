import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import * as ctrl from './activity.controller';

const router = Router();

router.use(authenticate);

router.get('/my', ctrl.getMy);
router.get('/', requireAdmin, ctrl.getLogs);

export default router;
