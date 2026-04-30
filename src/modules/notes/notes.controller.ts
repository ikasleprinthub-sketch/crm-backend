import { Request, Response, NextFunction } from 'express';
import * as svc from './notes.service';

export async function getMy(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getMyNotes(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.createNote(req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.updateNote(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteNote(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) { next(err); }
}
