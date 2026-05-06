import { Request, Response, NextFunction } from 'express';
import * as svc from './leads.service';
import { LeadStatus } from '@prisma/client';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = parseInt(req.query.page as string)  || 1;
    const limit  = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as LeadStatus | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const sourceId     = req.query.sourceId     as string | undefined;
    const search       = req.query.search       as string | undefined;

    const data = await svc.getAllLeads({ page, limit, status, departmentId, sourceId, search });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getLeadById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createLead(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateLead(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function convertToTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorId = req.user!.id;
    const data = await svc.convertLeadToTask(req.params.id, req.body, actorId);
    res.status(201).json({ success: true, message: 'Lead converted to task', data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorRole = req.user!.role;
    await svc.deleteLead(req.params.id, actorRole);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    next(error);
  }
}
