import { Request, Response } from 'express';
import * as svc from './activity.service';

export async function getLogs(req: Request, res: Response): Promise<void> {
  const page  = parseInt(req.query.page as string)  || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const taskId = req.query.taskId as string | undefined;
  const userId = req.query.userId as string | undefined;

  const data = await svc.getActivityLogs({ page, limit, taskId, userId });
  res.json({ success: true, data });
}
