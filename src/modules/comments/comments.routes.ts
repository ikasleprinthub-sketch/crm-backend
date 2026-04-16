import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as ctrl from './comments.controller';

const router = Router();

router.use(authenticate);

router.post('/',            ctrl.create);
router.get('/task/:taskId', ctrl.getByTask);
router.delete('/:id',       ctrl.remove);

export default router;
