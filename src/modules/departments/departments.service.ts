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
    },
  });
  if (!dept) throw new AppError('Department not found', 404);
  return dept;
}

export async function createDepartment(data: { name: string }, actorId: string) {
  const name = data.name.trim();
  if (!name) throw new AppError('Department name is required', 400);

  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) throw new AppError('A department with this name already exists', 409);

  const dept = await prisma.department.create({ data: { name } });

  await createLog({
    userId: actorId,
    action: 'DEPT_CREATED',
    message: `Department "${name}" created`,
  });

  return dept;
}

export async function updateDepartment(id: string, data: { name: string }, actorId: string) {
  const name = data.name.trim();
  if (!name) throw new AppError('Department name cannot be empty', 400);

  const dept = await getDepartmentById(id);
  
  const updated = await prisma.department.update({ 
    where: { id }, 
    data: { name } 
  });

  await createLog({
    userId: actorId,
    action: 'DEPT_UPDATED',
    message: `Department renamed from "${dept.name}" to "${name}"`,
  });

  return updated;
}

export async function deleteDepartment(id: string, actorId: string) {
  const dept = await getDepartmentById(id);

  // Deep relationship check
  const [taskTypeCount, taskCount, leadCount] = await Promise.all([
    prisma.taskType.count({ where: { departmentId: id } }),
    prisma.task.count({ where: { departmentId: id } }),
    prisma.lead.count({ where: { departmentId: id } }),
  ]);

  if (taskTypeCount > 0 || taskCount > 0 || leadCount > 0) {
    throw new AppError(
      `Cannot delete "${dept.name}". It is currently linked to ${taskTypeCount} task types, ${taskCount} tasks, and ${leadCount} leads. Please reassign or delete these first.`,
      400
    );
  }

  await prisma.department.delete({ where: { id } });

  await createLog({
    userId: actorId,
    action: 'DEPT_DELETED',
    message: `Department "${dept.name}" was deleted`,
  });

  return { success: true };
}
