import { NextFunction, Request, Response } from 'express';
import { PermissionType } from '@prisma/client';
import * as svc from './attendance.service';

export async function checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.checkIn(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.checkOut(req.user!.id, req.body.dayCompletion);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function submitMorningPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.submitMorningPlan(req.user!.id, req.body.morningPlan);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTodayAttendance(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getMy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year  = req.query.year  ? parseInt(req.query.year  as string) : undefined;
    const data = await svc.getMyAttendance(req.user!.id, month, year);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function applyPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { permissionType, reason, date } = req.body;
    const data = await svc.applyPermission(req.user!.id, permissionType as PermissionType, reason, date);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateMyPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { permissionType, reason, date } = req.body;
    const data = await svc.updateMyPermission(req.params.id, req.user!.id, { permissionType: permissionType as PermissionType, reason, dateStr: date });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteMyPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.deleteMyPermission(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getPendingPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getPendingPermissions(req.user!.id, req.user!.role);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function approvePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.approvePermission(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function rejectPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.rejectPermission(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getTeamAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTeamAttendance(req.user!.id, req.query.date as string | undefined);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function adminOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.adminOverride(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function autoMark(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.autoMarkAttendance();
    res.json({ success: true, data, message: `Marked ${data.length} records` });
  } catch (e) { next(e); }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getDashboardStats(req.user!.role, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAllAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year  = req.query.year  ? parseInt(req.query.year  as string) : undefined;
    const status = req.query.status as string | undefined;
    const data = await svc.getAllAttendance(req.query.date as string | undefined, month, year, status);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAuditLogs(req.query.attendanceId as string | undefined);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getTeamHierarchy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTeamHierarchy(req.query.date as string | undefined);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getPerformanceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const year  = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear();
    const data = await svc.getPerformanceStats(month, year);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCorrectionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createCorrectionRequest(req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getCorrectionRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getCorrectionRequests(req.user!.id, req.user!.role);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function reviewCorrectionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { approved, note } = req.body;
    const data = await svc.reviewCorrectionRequest(req.params.id, req.user!.id, Boolean(approved), note);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
