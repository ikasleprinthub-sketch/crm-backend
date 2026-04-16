import { Request, Response } from 'express';
import * as svc from './sop.service';

export async function getAll(_req: Request, res: Response): Promise<void> {
  const data = await svc.getAllTemplates();
  res.json({ success: true, data });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const data = await svc.getTemplateById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await svc.createTemplate(req.body);
  res.status(201).json({ success: true, data });
}

export async function updateSteps(req: Request, res: Response): Promise<void> {
  const data = await svc.updateTemplateSteps(req.params.id, req.body.steps);
  res.json({ success: true, data });
}

export async function addStep(req: Request, res: Response): Promise<void> {
  const data = await svc.addStep(req.params.id, req.body);
  res.status(201).json({ success: true, data });
}

export async function deleteStep(req: Request, res: Response): Promise<void> {
  await svc.deleteStep(req.params.stepId);
  res.json({ success: true, message: 'Step deleted' });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteTemplate(req.params.id);
  res.json({ success: true, message: 'SOP template deleted' });
}
