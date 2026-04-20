import { Router } from 'express';
import * as intelligenceController from './intelligence.controller';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';

const router = Router();

router.use(protect);
router.use(requireAdmin);

router.get('/attendance-trends', intelligenceController.getAttendanceTrends);
router.get('/performance-stats', intelligenceController.getPerformanceStats);

export default router;
