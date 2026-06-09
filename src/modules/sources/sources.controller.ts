import { NextFunction, Request, Response } from 'express';
import * as svc from './sources.service';

export async function getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAllSources();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAllSourcesAnalytics();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getOneAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getSourceAnalytics(req.params.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createSource(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateSource(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.toggleSourceStatus(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteSource(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Source deleted' });
  } catch (e) { next(e); }
}
