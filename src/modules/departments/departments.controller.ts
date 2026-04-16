import { Request, Response } from 'express';
import * as svc from './departments.service';

export async function getAll(req: Request, res: Response): Promise<void> {
  const data = await svc.getAllDepartments();
  res.json({ success: true, data });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const data = await svc.getDepartmentById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await svc.createDepartment(req.body, req.user!.id);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response): Promise<void> {
  const data = await svc.updateDepartment(req.params.id, req.body, req.user!.id);
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteDepartment(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Department deleted' });
}
