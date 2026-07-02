import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../../middleware/role.middleware';
import * as ctrl from './attendance.controller';

const router = Router();
router.use(protect);

// ── Employee ──────────────────────────────────────────────────────────────────
router.post('/check-in',     ctrl.checkIn);
router.post('/check-out',    ctrl.checkOut);
router.post('/morning-plan', ctrl.submitMorningPlan);
router.get('/today',         ctrl.getToday);
router.get('/my',            ctrl.getMy);
router.get('/stats',         ctrl.getDashboardStats);

// ── Permission requests ───────────────────────────────────────────────────────
router.post('/permission/apply',              ctrl.applyPermission);
router.put('/permission/my/:id',              ctrl.updateMyPermission);
router.delete('/permission/my/:id',           ctrl.deleteMyPermission);
router.get('/permission/team',  requireManager, ctrl.getPendingPermissions);
router.patch('/permission/:id/approve', requireManager, ctrl.approvePermission);
router.patch('/permission/:id/reject',  requireManager, ctrl.rejectPermission);

// ── Attendance correction requests ────────────────────────────────────────────
router.post('/correction/request',           ctrl.createCorrectionRequest);
router.get('/correction/requests',           ctrl.getCorrectionRequests);
router.patch('/correction/:id/review', requireManager, ctrl.reviewCorrectionRequest);

// ── Team / admin views ────────────────────────────────────────────────────────
router.get('/team',           requireManager, ctrl.getTeamAttendance);
router.get('/all',            requireAdmin,   ctrl.getAllAttendance);
router.get('/team-hierarchy', requireAdmin,   ctrl.getTeamHierarchy);
router.get('/performance',    requireManager, ctrl.getPerformanceStats);

// ── Audit logs ────────────────────────────────────────────────────────────────
router.get('/audit-logs', requireAdmin, ctrl.getAuditLogs);

// ── Report Download ───────────────────────────────────────────────────────────
// Accessible by managers (for their team) and admins (for all).
// Format: csv (file download) or json (preview data).
// Examples:
//   GET /attendance/report/download?periodType=monthly&month=6&year=2026
//   GET /attendance/report/download?periodType=yearly&year=2026
//   GET /attendance/report/download?periodType=custom&startDate=2026-01-01&endDate=2026-06-30
//   GET /attendance/report/download?periodType=monthly&month=6&year=2026&format=json
//   GET /attendance/report/download?periodType=monthly&month=6&year=2026&userId=<uuid>
router.get('/report/download', requireAdmin, ctrl.downloadReport);

// ── Admin override + auto-mark ────────────────────────────────────────────────
router.patch('/:id',      requireAdmin, ctrl.adminOverride);
router.post('/auto-mark', requireAdmin, ctrl.autoMark);

export default router;
