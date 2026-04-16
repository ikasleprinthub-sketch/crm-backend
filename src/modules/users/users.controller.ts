import { Request, Response } from 'express';
import * as svc from './users.service';
import { Role } from '@prisma/client';

export async function getAll(req: Request, res: Response): Promise<void> {
  const data = await svc.getAllUsers(req.user!);
  res.json({ success: true, data });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const data = await svc.getUserById(req.params.id, req.user!);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await svc.createUser({ ...req.body, role: req.body.role as Role });
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response): Promise<void> {
  const data = await svc.updateUser(req.params.id, req.body, req.user!);
  res.json({ success: true, data });
}

export async function assignManager(req: Request, res: Response): Promise<void> {
  const { managerId } = req.body;
  const data = await svc.assignToManager(req.params.id, managerId ?? null);
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteUser(req.params.id, req.user!.id);
  res.json({ success: true, message: 'User deleted' });
}

export async function getMyTeam(req: Request, res: Response): Promise<void> {
  const data = await svc.getMyTeam(req.user!.id);
  res.json({ success: true, data });
}
