import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './attendance.controller';

const router = Router();
router.use(protect);

// ── Employee (no approval) ────────────────────────────────────────────────────
router.post('/check-in',      ctrl.checkIn);
router.post('/check-out',     ctrl.checkOut);
router.post('/morning-plan',  ctrl.submitMorningPlan);
router.get('/today',          ctrl.getToday);
router.get('/my',             ctrl.getMy);
router.get('/stats',          ctrl.getDashboardStats);

// ── Permission (needs approval) ───────────────────────────────────────────────
router.post('/permission/apply',            ctrl.applyPermission);
router.get('/permission/team',  requireManager, ctrl.getPendingPermissions);
router.patch('/permission/:id/approve', requireManager, ctrl.approvePermission);
router.patch('/permission/:id/reject',  requireManager, ctrl.rejectPermission);

// ── Team / admin views ────────────────────────────────────────────────────────
router.get('/team', requireManager, ctrl.getTeamAttendance);
router.get('/all',  requireAdmin,   ctrl.getAllAttendance);

// ── Admin override + auto-mark ────────────────────────────────────────────────
router.patch('/:id',       requireAdmin, ctrl.adminOverride);
router.post('/auto-mark',  requireAdmin, ctrl.autoMark);

export default router;
