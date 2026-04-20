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

export async function getAllAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year  = req.query.year  ? parseInt(req.query.year  as string) : undefined;
    const data = await svc.getAllAttendance(req.query.date as string | undefined, month, year);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function adminOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.adminOverride(req.params.id, req.body);
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
