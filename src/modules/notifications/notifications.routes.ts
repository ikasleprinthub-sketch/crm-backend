import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as ctrl from './notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/',             ctrl.getMy);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/:id/read',   ctrl.markRead);
router.patch('/read-all',   ctrl.markAllRead);

export default router;
