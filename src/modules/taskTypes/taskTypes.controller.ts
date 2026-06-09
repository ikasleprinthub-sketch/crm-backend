import { NextFunction, Request, Response } from 'express';
import * as svc from './taskTypes.service';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAllTaskTypes(req.query.departmentId as string | undefined);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTaskTypeById(req.params.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createTaskType(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateTaskType(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.toggleTaskTypeStatus(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteTaskType(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Task type deleted' });
  } catch (e) { next(e); }
}
