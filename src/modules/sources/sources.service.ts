import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createLog } from '../activity/activity.service';

export async function getAllSources() {
  return prisma.sourceOfLead.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  });
}

export async function createSource(data: { name: string }, actorId: string) {
  const name = data.name.trim();
  if (!name) throw new AppError('Source name is required', 400);

  const existing = await prisma.sourceOfLead.findUnique({ where: { name } });
  if (existing) throw new AppError('Source with this name already exists', 409);

  const src = await prisma.sourceOfLead.create({ data: { name } });

  await createLog({
    userId: actorId,
    action: 'SOURCE_CREATED',
    message: `Lead Source "${name}" created`,
  });

  return src;
}

export async function updateSource(id: string, data: { name: string }, actorId: string) {
  const name = data.name.trim();
  if (!name) throw new AppError('Source name cannot be empty', 400);

  const src = await prisma.sourceOfLead.findUnique({ where: { id } });
  if (!src) throw new AppError('Source not found', 404);

  const updated = await prisma.sourceOfLead.update({ 
    where: { id }, 
    data: { name } 
  });

  await createLog({
    userId: actorId,
    action: 'SOURCE_UPDATED',
    message: `Lead Source renamed from "${src.name}" to "${name}"`,
  });

  return updated;
}

export async function deleteSource(id: string, actorId: string) {
  const src = await prisma.sourceOfLead.findUnique({ where: { id } });
  if (!src) throw new AppError('Source not found', 404);

  const leadCount = await prisma.lead.count({ where: { sourceId: id } });
  if (leadCount > 0) {
    throw new AppError(`Cannot delete source "${src.name}" because it is currently linked to ${leadCount} leads.`, 400);
  }

  await prisma.sourceOfLead.delete({ where: { id } });

  await createLog({
    userId: actorId,
    action: 'SOURCE_DELETED',
    message: `Lead Source "${src.name}" was deleted`,
  });

  return { success: true };
}
