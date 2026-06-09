import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createLog } from '../activity/activity.service';

export async function getAllSources() {
  return prisma.sourceOfLead.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  });
}

export async function getSourceById(id: string) {
  const src = await prisma.sourceOfLead.findUnique({
    where: { id },
    include: { _count: { select: { leads: true } } },
  });
  if (!src) throw new AppError('Source not found', 404);
  return src;
}

export async function createSource(
  data: { name: string; description?: string },
  actorId: string
) {
  const name = data.name.trim();
  if (!name) throw new AppError('Source name is required', 400);

  const existing = await prisma.sourceOfLead.findUnique({ where: { name } });
  if (existing) throw new AppError('Source with this name already exists', 409);

  const src = await prisma.sourceOfLead.create({
    data: { name, description: data.description?.trim() || null },
  });

  await createLog({ userId: actorId, action: 'SOURCE_CREATED', message: `Lead Source "${name}" created` });

  return src;
}

export async function updateSource(
  id: string,
  data: { name?: string; description?: string },
  actorId: string
) {
  const src = await getSourceById(id);

  const name = data.name?.trim();
  if (name === '') throw new AppError('Source name cannot be empty', 400);

  if (name && name !== src.name) {
    const existing = await prisma.sourceOfLead.findUnique({ where: { name } });
    if (existing) throw new AppError('Source with this name already exists', 409);
  }

  const updated = await prisma.sourceOfLead.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
    },
  });

  await createLog({ userId: actorId, action: 'SOURCE_UPDATED', message: `Lead Source "${src.name}" updated` });

  return updated;
}

export async function toggleSourceStatus(id: string, actorId: string) {
  const src = await getSourceById(id);

  if (src.isActive) {
    const activeLeads = await prisma.lead.count({
      where: { sourceId: id, status: { notIn: ['DROPPED', 'CONVERTED'] } },
    });
    if (activeLeads > 0) {
      throw new AppError(
        `Cannot disable "${src.name}". It has ${activeLeads} active leads.`,
        400
      );
    }
  }

  const updated = await prisma.sourceOfLead.update({
    where: { id },
    data: { isActive: !src.isActive },
  });

  await createLog({
    userId: actorId,
    action: 'SOURCE_UPDATED',
    message: `Lead Source "${src.name}" ${updated.isActive ? 'enabled' : 'disabled'}`,
  });

  return updated;
}

export async function getSourceAnalytics(id: string) {
  const src = await getSourceById(id);

  const [total, converted, lost, active] = await Promise.all([
    prisma.lead.count({ where: { sourceId: id } }),
    prisma.lead.count({ where: { sourceId: id, status: 'CONVERTED' } }),
    prisma.lead.count({ where: { sourceId: id, status: 'DROPPED' } }),
    prisma.lead.count({ where: { sourceId: id, status: { notIn: ['DROPPED', 'CONVERTED'] } } }),
  ]);

  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return {
    source: src,
    analytics: { total, converted, lost, active, conversionRate },
  };
}

export async function getAllSourcesAnalytics() {
  const sources = await prisma.sourceOfLead.findMany({ orderBy: { name: 'asc' } });

  const analytics = await Promise.all(
    sources.map(async (src) => {
      const [total, converted, lost] = await Promise.all([
        prisma.lead.count({ where: { sourceId: src.id } }),
        prisma.lead.count({ where: { sourceId: src.id, status: 'CONVERTED' } }),
        prisma.lead.count({ where: { sourceId: src.id, status: 'DROPPED' } }),
      ]);
      const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return { ...src, total, converted, lost, active: total - converted - lost, conversionRate };
    })
  );

  return analytics;
}

export async function deleteSource(id: string, actorId: string) {
  const src = await getSourceById(id);

  const leadCount = await prisma.lead.count({ where: { sourceId: id } });
  if (leadCount > 0) {
    throw new AppError(
      `Cannot delete source "${src.name}" because it is linked to ${leadCount} leads.`,
      400
    );
  }

  await prisma.sourceOfLead.delete({ where: { id } });

  await createLog({ userId: actorId, action: 'SOURCE_DELETED', message: `Lead Source "${src.name}" deleted` });

  return { success: true };
}
