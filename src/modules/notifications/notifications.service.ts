import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({ data });

  // 🔥 Real-time Notification via WebSocket
  try {
    const { emitNotification } = await import('../../lib/socket');
    emitNotification(data.userId, notification);
  } catch (err) {
    console.error('Failed to emit socket notification:', err);
  }

  return notification;
}

export async function getMyNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { count };
}

export async function markAsRead(id: string, userId: string) {
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) throw new AppError('Notification not found', 404);
  if (notif.userId !== userId) throw new AppError('Unauthorized', 403);

  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
