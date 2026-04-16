import { Request, Response } from 'express';
import * as svc from './sources.service';

export async function getAll(_req: Request, res: Response): Promise<void> {
  const data = await svc.getAllSources();
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await svc.createSource(req.body, req.user!.id);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response): Promise<void> {
  const data = await svc.updateSource(req.params.id, req.body, req.user!.id);
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteSource(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Source deleted' });
}
