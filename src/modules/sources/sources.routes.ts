import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import * as ctrl from './sources.controller';

const router = Router();

router.use(authenticate);

router.get('/',        ctrl.getAll);
router.post('/',       requireAdmin, ctrl.create);
router.put('/:id',     requireAdmin, ctrl.update);
router.delete('/:id',  requireAdmin, ctrl.remove);

export default router;
