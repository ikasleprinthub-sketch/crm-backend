import { Request, Response, NextFunction } from 'express';
import { DocumentCategory } from '@prisma/client';
import * as svc from './documents.service';
import { AppError } from '../../middleware/error.middleware';

// ─── Lead Documents ───────────────────────────────────────────────────────────

export async function getLeadDocs(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getLeadDocuments(req.params.leadId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadLeadDoc(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const { category } = req.body;
    if (!category || !Object.values(DocumentCategory).includes(category)) {
      throw new AppError(`category must be one of: ${Object.values(DocumentCategory).join(', ')}`, 400);
    }

    const data = await svc.createLeadDocument(req.params.leadId, req.file, category as DocumentCategory, (req as any).user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteLeadDoc(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteLeadDocument(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
}

// ─── Task Documents ───────────────────────────────────────────────────────────

export async function getTaskDocs(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getTaskDocuments(req.params.taskId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadTaskDoc(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const data = await svc.createTaskDocument(req.params.taskId, req.file, (req as any).user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteTaskDoc(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteTaskDocument(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
}
