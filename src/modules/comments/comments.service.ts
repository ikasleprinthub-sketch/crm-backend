import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createNotification } from '../notifications/notifications.service';

export async function addComment(data: {
  userId: string;
  taskId: string;
  content: string;
}) {
  const task = await prisma.task.findUnique({ 
    where: { id: data.taskId },
    include: { assignedTo: true }
  });
  if (!task) throw new AppError('Task not found', 404);

  const comment = await prisma.comment.create({
    data,
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  // Notify assignee if someone else comments
  if (task.assignedToId && task.assignedToId !== data.userId) {
    await createNotification({
      userId:  task.assignedToId,
      title:   'New Comment on Task',
      message: `${comment.user.name} commented on your task ${task.taskNo}`,
      type:    'TASK_COMMENT',
      link:    `/tasks/${task.id}`,
    });
  }

  return comment;
}

export async function getTaskComments(taskId: string) {
  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });
}

export async function deleteComment(id: string, userId: string, role: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new AppError('Comment not found', 404);

  // Author or Admin can delete
  if (comment.userId !== userId && role !== 'ADMIN') {
    throw new AppError('Not authorized to delete this comment', 403);
  }

  return prisma.comment.delete({ where: { id } });
}
