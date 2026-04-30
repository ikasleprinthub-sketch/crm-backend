import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export async function getMyNotes(userId: string) {
  return prisma.note.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createNote(userId: string, data: { title?: string; content: string; color?: string }) {
  const { title, content, color } = data;
  if (!content) throw new AppError('content is required', 400);
  return prisma.note.create({
    data: { userId, title, content, color },
  });
}

export async function updateNote(id: string, userId: string, data: { title?: string; content?: string; color?: string }) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new AppError('Note not found', 404);
  if (note.userId !== userId) throw new AppError('Unauthorized', 403);

  const { title, content, color } = data;
  return prisma.note.update({
    where: { id },
    data: { title, content, color },
  });
}

export async function deleteNote(id: string, userId: string) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new AppError('Note not found', 404);
  if (note.userId !== userId) throw new AppError('Unauthorized', 403);

  return prisma.note.delete({ where: { id } });
}
