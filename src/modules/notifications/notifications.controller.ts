import { Request, Response } from 'express';
import * as svc from './notifications.service';

export async function getMy(req: Request, res: Response): Promise<void> {
  const data = await svc.getMyNotifications(req.user!.id);
  res.json({ success: true, data });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const data = await svc.getUnreadCount(req.user!.id);
  res.json({ success: true, data });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const data = await svc.markAsRead(req.params.id, req.user!.id);
  res.json({ success: true, data });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await svc.markAllAsRead(req.user!.id);
  res.json({ success: true, message: 'All notifications marked as read' });
}
