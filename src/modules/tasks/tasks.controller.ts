import { Request, Response, NextFunction } from 'express';
import * as svc from './tasks.service';
import { TaskStatus, Priority } from '@prisma/client';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor  = req.user!;
    const page   = parseInt(req.query.page as string)  || 1;
    const limit  = parseInt(req.query.limit as string) || 20;
    const data = await svc.getAllTasks(actor, {
      page,
      limit,
      status:       req.query.status       as TaskStatus | undefined,
      priority:     req.query.priority     as Priority   | undefined,
      departmentId: req.query.departmentId as string     | undefined,
      assignedToId: req.query.assignedToId as string     | undefined,
      search:       req.query.search       as string     | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTaskById(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createNewTask(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateTask(req.params.id, req.body, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function toggleStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isCompleted } = req.body;
    const data = await svc.toggleSOPStep(req.params.id, req.params.stepId, !!isCompleted, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function undoStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.undoSOPStep(req.params.id, req.params.stepId, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTaskActivity(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteTask(req.params.id, req.user!);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
}
