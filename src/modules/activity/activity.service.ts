import { prisma } from '../../lib/prisma';

// ─── GET paginated activity logs ──────────────────────────────────────────────
export async function getActivityLogs(opts: {
  page?: number;
  limit?: number;
  taskId?: string;
  userId?: string;
}) {
  const { taskId, userId } = opts;
  const page = opts.page || 1;
  const limit = opts.limit || 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(taskId ? { taskId } : {}),
    ...(userId ? { userId } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, taskNo: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ─── Create a log entry (internal use) ───────────────────────────────────────
export async function createLog(data: {
  userId: string;
  taskId?: string;
  action: string;
  message?: string;
}) {
  return prisma.activityLog.create({ data });
}
