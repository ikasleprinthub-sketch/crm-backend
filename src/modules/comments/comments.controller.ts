import { Request, Response } from 'express';
import * as svc from './comments.service';

export async function create(req: Request, res: Response): Promise<void> {
  const data = await svc.addComment({
    userId: req.user!.id,
    taskId: req.body.taskId,
    content: req.body.content,
  });
  res.status(201).json({ success: true, data });
}

export async function getByTask(req: Request, res: Response): Promise<void> {
  const data = await svc.getTaskComments(req.params.taskId);
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteComment(req.params.id, req.user!.id, req.user!.role);
  res.json({ success: true, message: 'Comment deleted' });
}
