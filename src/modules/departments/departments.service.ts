import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createLog } from '../activity/activity.service';

export async function getAllDepartments() {
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { taskTypes: true, leads: true, tasks: true } },
    },
  });
}

export async function getDepartmentById(id: string) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      taskTypes: { orderBy: { name: 'asc' } },
      _count: { select: { taskTypes: true, leads: true, tasks: true } },
    },
  });
  if (!dept) throw new AppError('Department not found', 404);
  return dept;
}

export async function createDepartment(
  data: { name: string; code?: string; description?: string },
  actorId: string
) {
  const name = data.name.trim();
  if (!name) throw new AppError('Department name is required', 400);

  const code = data.code?.trim().toUpperCase() || null;

  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) throw new AppError('A department with this name already exists', 409);

  if (code) {
    const codeExists = await prisma.department.findUnique({ where: { code } });
    if (codeExists) throw new AppError('A department with this code already exists', 409);
  }

  const dept = await prisma.department.create({
    data: { name, code, description: data.description?.trim() || null },
  });

  await createLog({ userId: actorId, action: 'DEPT_CREATED', message: `Department "${name}" created` });

  return dept;
}

export async function updateDepartment(
  id: string,
  data: { name?: string; code?: string; description?: string },
  actorId: string
) {
  const dept = await getDepartmentById(id);

  const name = data.name?.trim();
  if (name === '') throw new AppError('Department name cannot be empty', 400);

  const code = data.code !== undefined ? (data.code.trim().toUpperCase() || null) : undefined;

  if (name && name !== dept.name) {
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) throw new AppError('A department with this name already exists', 409);
  }

  if (code && code !== dept.code) {
    const codeExists = await prisma.department.findUnique({ where: { code } });
    if (codeExists) throw new AppError('A department with this code already exists', 409);
  }

  const updated = await prisma.department.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
    },
  });

  await createLog({ userId: actorId, action: 'DEPT_UPDATED', message: `Department "${dept.name}" updated` });

  return updated;
}

export async function toggleDepartmentStatus(id: string, actorId: string) {
  const dept = await getDepartmentById(id);

  if (dept.isActive) {
    const [userCount, taskCount, leadCount] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }), // Not directly linked but for reference
      prisma.task.count({ where: { departmentId: id, status: { not: 'COMPLETED' } } }),
      prisma.lead.count({ where: { departmentId: id, status: { not: 'DROPPED' } } }),
    ]);

    if (taskCount > 0 || leadCount > 0) {
      throw new AppError(
        `Cannot disable "${dept.name}". It has ${taskCount} active tasks and ${leadCount} active leads.`,
        400
      );
    }
  }

  const updated = await prisma.department.update({
    where: { id },
    data: { isActive: !dept.isActive },
  });

  await createLog({
    userId: actorId,
    action: 'DEPT_UPDATED',
    message: `Department "${dept.name}" ${updated.isActive ? 'enabled' : 'disabled'}`,
  });

  return updated;
}

export async function deleteDepartment(id: string, actorId: string) {
  const dept = await getDepartmentById(id);

  const [taskTypeCount, taskCount, leadCount] = await Promise.all([
    prisma.taskType.count({ where: { departmentId: id } }),
    prisma.task.count({ where: { departmentId: id } }),
    prisma.lead.count({ where: { departmentId: id } }),
  ]);

  if (taskTypeCount > 0 || taskCount > 0 || leadCount > 0) {
    throw new AppError(
      `Cannot delete "${dept.name}". It is linked to ${taskTypeCount} task types, ${taskCount} tasks, and ${leadCount} leads.`,
      400
    );
  }

  await prisma.department.delete({ where: { id } });

  await createLog({ userId: actorId, action: 'DEPT_DELETED', message: `Department "${dept.name}" deleted` });

  return { success: true };
}

export async function getDepartmentStats(id: string) {
  const [employeeCount, taskCount, leadCount] = await Promise.all([
    prisma.user.count({
      where: {
        status: 'ACTIVE',
        assignedTasks: { some: { departmentId: id } },
      },
    }),
    prisma.task.count({ where: { departmentId: id } }),
    prisma.lead.count({ where: { departmentId: id } }),
  ]);

  const taskBreakdown = await prisma.task.groupBy({
    by: ['status'],
    where: { departmentId: id },
    _count: { id: true },
  });

  return { employeeCount, taskCount, leadCount, taskBreakdown };
}
