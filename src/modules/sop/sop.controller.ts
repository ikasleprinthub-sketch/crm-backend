import { Request, Response } from 'express';
import * as svc from './sop.service';

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const data = await svc.getTemplateByTaskType(req.params.taskTypeId);
  res.json({ success: true, data });
  return;
}

export async function saveTemplate(req: Request, res: Response): Promise<void> {
  const { steps } = req.body;
  if (!Array.isArray(steps)) {
    res.status(400).json({ success: false, message: 'Steps must be an array' });
    return;
  }
  const data = await svc.updateTemplateSteps(req.params.taskTypeId, steps);
  res.json({ success: true, data });
  return;
}
