import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { TaskStatus, Priority, Role } from '@prisma/client';
import { createLog } from '../activity/activity.service';
import { createNotification } from '../notifications/notifications.service';

// ─── Include shape ─────────────────────────────────────────────────────────────
const taskInclude = {
  lead:       { select: { id: true, leadNo: true, leadName: true } },
  department: { select: { id: true, name: true } },
  taskType:   { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true, managerId: true } },
  sopSteps:   { orderBy: { order: 'asc' as const } },
} as const;

// ─── CREATE task ──────────────────────────────────────────────────────────────
export async function createNewTask(data: any, actorId: string) {
  const taskNo = `T-${Date.now()}`;
  
  const task = await prisma.task.create({
    data: {
      taskNo,
      leadId:        data.leadId,
      departmentId:  data.departmentId,
      taskTypeId:    data.taskTypeId,
      assignedToId:  data.assignedToId,
      priority:      data.priority || Priority.REGULAR,
      status:        data.status   || TaskStatus.NOT_YET_STARTED,
      remarks:       data.remarks,
      contactName:   data.contactName,
      contactNumber: data.contactNumber,
      email:         data.email,
      startDate:     data.startDate ? (() => {
        const d = new Date(data.startDate);
        if (isNaN(d.getTime())) throw new AppError('Invalid start date format', 400);
        return d;
      })() : undefined,
      completionDate:data.completionDate ? (() => {
        const d = new Date(data.completionDate);
        if (isNaN(d.getTime())) throw new AppError('Invalid completion date format', 400);
        return d;
      })() : undefined,
    },
    include: taskInclude
  });

  // Automatically fetch SOP Template and create Steps
  const template = await prisma.sOPTemplate.findUnique({
    where: { taskTypeId: data.taskTypeId },
    include: { steps: true }
  });

  if (template && template.steps.length > 0) {
    const steps = template.steps.map(s => ({
      taskId: task.id,
      title:  s.title,
      order:  s.order,
      isCompleted: false
    }));

    await prisma.taskSOPStep.createMany({ data: steps });
  }

  // Notify assignee
  await createNotification({
    userId:  data.assignedToId,
    title:   'New Task Assigned',
    message: `You have been assigned task ${taskNo}`,
    type:    'TASK_ASSIGNED',
    link:    `/tasks/${task.id}`,
  });

  // Refetch to include the newly created SOP steps
  return prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
}

// ─── GET all tasks (role-filtered) ───────────────────────────────────────────
export async function getAllTasks(
  actor: { id: string; role: string },
  opts: {
    page: number;
    limit: number;
    status?: TaskStatus;
    priority?: Priority;
    departmentId?: string;
    assignedToId?: string;
    search?: string;
  }
) {
  const { page, limit, status, priority, departmentId, assignedToId, search } = opts;
  const skip = (page - 1) * limit;

  // Employees only see their own tasks
  const roleFilter =
    actor.role === Role.EMPLOYEE
      ? { assignedToId: actor.id }
      : actor.role === Role.MANAGER
      ? {
          // Manager sees tasks assigned to themselves OR their team members
          OR: [
            { assignedToId: actor.id },
            { assignedTo: { managerId: actor.id } },
          ],
        }
      : {}; // SUPER_ADMIN sees all

  const where = {
    ...roleFilter,
    ...(status       ? { status }       : {}),
    ...(priority     ? { priority }     : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(assignedToId && actor.role === Role.SUPER_ADMIN ? { assignedToId } : {}),
    ...(search
      ? {
          OR: [
            { taskNo:      { contains: search, mode: 'insensitive' as const } },
            { contactName: { contains: search, mode: 'insensitive' as const } },
            { remarks:     { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: taskInclude }),
    prisma.task.count({ where }),
  ]);

  return { tasks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ─── GET single task ──────────────────────────────────────────────────────────
export async function getTaskById(id: string, actor: { id: string; role: string }) {
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!task) throw new AppError('Task not found', 404);

  // Access control
  if (actor.role === Role.EMPLOYEE && task.assignedToId !== actor.id) {
    throw new AppError('Access denied', 403);
  }
  if (actor.role === Role.MANAGER) {
    const isOwn  = task.assignedToId === actor.id;
    const isTeam = task.assignedTo.role === Role.EMPLOYEE &&
                   (await prisma.user.findFirst({
                     where: { id: task.assignedToId, managerId: actor.id },
                   })) !== null;
    if (!isOwn && !isTeam) throw new AppError('Access denied', 403);
  }

  return task;
}

// ─── UPDATE task status / priority / assignment ───────────────────────────────
export async function updateTask(
  id: string,
  data: Partial<{
    status: TaskStatus;
    priority: Priority;
    assignedToId: string;
    remarks: string;
    contactName: string;
    contactNumber: string;
    email: string;
    startDate: string;
    completionDate: string;
  }>,
  actor: { id: string; role: string }
) {
  const task = await getTaskById(id, actor);

  // Only Admin/Manager can reassign
  if (data.assignedToId && actor.role === Role.EMPLOYEE) {
    throw new AppError('Employees cannot reassign tasks', 403);
  }

  // Only Admin/Manager can mark tasks as COMPLETED
  if (data.status === TaskStatus.COMPLETED && actor.role === Role.EMPLOYEE) {
    throw new AppError('Employees cannot mark tasks as completed. Please submit for approval instead.', 403);
  }

  // Auto-set completionDate when marked COMPLETED
  const completionDate =
    data.status === TaskStatus.COMPLETED && !task.completionDate
      ? new Date()
      : data.completionDate
      ? new Date(data.completionDate)
      : undefined;

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.status        ? { status: data.status }               : {}),
      ...(data.priority      ? { priority: data.priority }           : {}),
      ...(data.assignedToId  ? { assignedToId: data.assignedToId }   : {}),
      ...(data.remarks       !== undefined ? { remarks: data.remarks }           : {}),
      ...(data.contactName   !== undefined ? { contactName: data.contactName }   : {}),
      ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber } : {}),
      ...(data.email         !== undefined ? { email: data.email }               : {}),
      ...(data.startDate     ? { startDate: (() => {
        const d = new Date(data.startDate);
        if (isNaN(d.getTime())) throw new AppError('Invalid start date format', 400);
        return d;
      })() } : {}),
      ...(completionDate     ? { completionDate }                      : {}),
    },
    include: taskInclude,
  });

  // Log activity
  if (data.status) {
    await createLog({
      userId: actor.id,
      taskId: id,
      action: 'STATUS_CHANGED',
      message: `Status changed to ${data.status} on task ${task.taskNo}`,
    });

    // Notify assignee if someone else changed the status
    if (updated.assignedToId !== actor.id) {
      await createNotification({
        userId:  updated.assignedToId,
        title:   'Task Status Updated',
        message: `Task ${task.taskNo} is now ${data.status}`,
        type:    'STATUS_UPDATE',
        link:    `/tasks/${id}`,
      });
    }

    // If marked COMPLETED, notify the manager
    if (data.status === TaskStatus.COMPLETED && updated.assignedTo.managerId) {
      await createNotification({
        userId:  updated.assignedTo.managerId,
        title:   'Task Completed',
        message: `${updated.assignedTo.name} completed task ${task.taskNo}`,
        type:    'TASK_COMPLETED',
        link:    `/tasks/${id}`,
      });
    }
  }

  return updated;
}

// ─── COMPLETE an SOP step ─────────────────────────────────────────────────────
export async function completeSOPStep(
  taskId: string,
  stepId: string,
  actor: { id: string; role: string }
) {
  await getTaskById(taskId, actor);

  const step = await prisma.taskSOPStep.findFirst({
    where: { id: stepId, taskId },
  });
  if (!step) throw new AppError('SOP step not found on this task', 404);
  if (step.isCompleted) throw new AppError('Step already completed', 400);

  const updated = await prisma.taskSOPStep.update({
    where: { id: stepId },
    data: { isCompleted: true, completedAt: new Date() },
  });

  await createLog({
    userId: actor.id,
    taskId,
    action: 'SOP_STEP_COMPLETED',
    message: `Step "${step.title}" marked complete`,
  });

  // Auto-mark task COMPLETED if all steps done
  const remaining = await prisma.taskSOPStep.count({
    where: { taskId, isCompleted: false },
  });
  if (remaining === 0) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED, completionDate: new Date() },
    });
    await createLog({
      userId: actor.id,
      taskId,
      action: 'TASK_AUTO_COMPLETED',
      message: 'All SOP steps done — task auto-marked as COMPLETED',
    });
  }

  return updated;
}

// ─── UNDO an SOP step ─────────────────────────────────────────────────────────
export async function undoSOPStep(
  taskId: string,
  stepId: string,
  actor: { id: string; role: string }
) {
  await getTaskById(taskId, actor);

  const step = await prisma.taskSOPStep.findFirst({ where: { id: stepId, taskId } });
  if (!step) throw new AppError('SOP step not found on this task', 404);

  return prisma.taskSOPStep.update({
    where: { id: stepId },
    data: { isCompleted: false, completedAt: null },
  });
}

// ─── GET activity for a task ──────────────────────────────────────────────────
export async function getTaskActivity(taskId: string, actor: { id: string; role: string }) {
  await getTaskById(taskId, actor);

  return prisma.activityLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}
// ─── DELETE task ──────────────────────────────────────────────────────────────
export async function deleteTask(id: string, actor: { id: string; role: string }) {
  if (actor.role !== Role.SUPER_ADMIN) {
    throw new AppError('Only administrators can delete tasks', 403);
  }
  await getTaskById(id, actor);
  return prisma.task.delete({ where: { id } });
}
