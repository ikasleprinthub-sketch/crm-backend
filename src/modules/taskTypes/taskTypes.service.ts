import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createLog } from '../activity/activity.service';

export async function getAllTaskTypes(departmentId?: string) {
  return prisma.taskType.findMany({
    where: departmentId ? { departmentId } : undefined,
    orderBy: { name: 'asc' },
    include: {
      department: { select: { id: true, name: true } },
      sopTemplate: { select: { id: true } },
      _count: { select: { leads: true, tasks: true } },
    },
  });
}

export async function getTaskTypeById(id: string) {
  const tt = await prisma.taskType.findUnique({
    where: { id },
    include: {
      department: true,
      sopTemplate: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!tt) throw new AppError('Task type not found', 404);
  return tt;
}

export async function createTaskType(data: { name: string; departmentId: string }, actorId: string) {
  const name = data.name.trim();
  if (!name) throw new AppError('Task type name is required', 400);

  const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
  if (!dept) throw new AppError('Department not found', 404);

  const tt = await prisma.taskType.create({
    data: { name, departmentId: data.departmentId },
    include: { department: { select: { id: true, name: true } } },
  });

  await createLog({
    userId: actorId,
    action: 'TASK_TYPE_CREATED',
    message: `Task Type "${name}" created in department "${dept.name}"`,
  });

  return tt;
}

export async function updateTaskType(id: string, data: { name?: string; departmentId?: string }, actorId: string) {
  const tt = await getTaskTypeById(id);
  
  const name = data.name?.trim();
  if (name === '') throw new AppError('Name cannot be empty', 400);

  if (data.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new AppError('Department not found', 404);
  }

  const updated = await prisma.taskType.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.departmentId ? { departmentId: data.departmentId } : {}),
    },
    include: { department: { select: { id: true, name: true } } },
  });

  await createLog({
    userId: actorId,
    action: 'TASK_TYPE_UPDATED',
    message: `Task Type "${tt.name}" was modified`,
  });

  return updated;
}

export async function deleteTaskType(id: string, actorId: string) {
  const tt = await getTaskTypeById(id);
  
  const [taskCount, leadCount, sopCount] = await Promise.all([
    prisma.task.count({ where: { taskTypeId: id } }),
    prisma.lead.count({ where: { taskTypeId: id } }),
    prisma.sOPTemplate.count({ where: { taskTypeId: id } }),
  ]);

  if (taskCount > 0 || leadCount > 0 || sopCount > 0) {
    throw new AppError(
      `Cannot delete "${tt.name}". It is linked to ${taskCount} tasks, ${leadCount} leads, and ${sopCount} SOP templates.`,
      400
    );
  }

  await prisma.taskType.delete({ where: { id } });

  await createLog({
    userId: actorId,
    action: 'TASK_TYPE_DELETED',
    message: `Task Type "${tt.name}" was deleted`,
  });

  return { success: true };
}
