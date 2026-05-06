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
  
  // Email validation
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new AppError('Invalid email format', 400);
    }
    if (data.email !== data.email.toLowerCase()) {
      throw new AppError('Email must be in all lowercase letters (no capitals allowed)', 400);
    }
  }
  
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
        
        // Ensure completion date is not before start date
        if (data.startDate) {
          const start = new Date(data.startDate);
          if (d < start) {
            throw new AppError('Completion date cannot be before start date.', 400);
          }
        }
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
    const steps = template.steps.map(s => {
      let dueAt = null;
      if (s.deadlineHours > 0) {
        dueAt = new Date(Date.now() + s.deadlineHours * 60 * 60 * 1000);
      }
      return {
        taskId: task.id,
        title:  s.title,
        order:  s.order,
        isCompleted: false,
        assignedRole: s.assignedRole,
        deadlineHours: s.deadlineHours,
        dueAt
      };
    });

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
  
  // Email validation
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new AppError('Invalid email format', 400);
    }
    if (data.email !== data.email.toLowerCase()) {
      throw new AppError('Email must be in all lowercase letters (no capitals allowed)', 400);
    }
  }

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

  // RESTRICTION: Admins/Managers cannot edit core fields once task is created.
  // They can only change Status, Priority, and SOP Steps.
  const isPrivileged = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN || actor.role === Role.MANAGER;
  
  if (isPrivileged) {
    const coreFields = ['assignedToId', 'leadId', 'departmentId', 'taskTypeId', 'startDate', 'completionDate'];
    const attemptedCoreEdits = Object.keys(data).filter(key => coreFields.includes(key));
    
    if (attemptedCoreEdits.length > 0) {
      throw new AppError(`Admins/Managers cannot edit core task details (${attemptedCoreEdits.join(', ')}) after creation.`, 403);
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.status        ? { status: data.status }               : {}),
      ...(data.priority      ? { priority: data.priority }           : {}),
      ...(data.remarks       !== undefined ? { remarks: data.remarks }           : {}),
      ...(data.contactName   !== undefined ? { contactName: data.contactName }   : {}),
      ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber } : {}),
      ...(data.email         !== undefined ? { email: data.email }               : {}),
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

    // Notification Logic
    const assigneeId = updated.assignedToId;
    const managerId  = updated.assignedTo.managerId;

    // 1. Notify Assignee if someone else changed it
    if (assigneeId !== actor.id) {
      await createNotification({
        userId:  assigneeId,
        title:   'Task Status Updated',
        message: `Task ${task.taskNo} is now ${data.status}`,
        type:    'STATUS_UPDATE',
        link:    `/tasks/${id}`,
      });
    }

    // 2. If an EMPLOYEE changed the status, notify Manager and all Admins
    if (actor.role === Role.EMPLOYEE) {
      const isPending = data.status === TaskStatus.PENDING_FOR_APPROVAL;
      const title = isPending ? 'Task Awaiting Approval' : 'Team Task Updated';
      const msg = isPending 
        ? `${updated.assignedTo.name} has finished task ${task.taskNo} and is awaiting your approval.`
        : `${updated.assignedTo.name} updated task ${task.taskNo} to ${data.status}`;

      // Notify Manager
      if (managerId) {
        await createNotification({
          userId:  managerId,
          title,
          message: msg,
          type:    'TASK_UPDATE',
          link:    `/tasks/${id}`,
        });
      }

      // Notify all ADMINS and SUPER_ADMINS
      const admins = await prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true }
      });

      for (const admin of admins) {
        if (admin.id === actor.id) continue; // Don't notify self
        await createNotification({
          userId:  admin.id,
          title,
          message: msg,
          type:    'TASK_UPDATE',
          link:    `/tasks/${id}`,
        });
      }
    }

    // 3. If a Manager/Admin marks as COMPLETED, notify the Assignee (Employee)
    if (data.status === TaskStatus.COMPLETED && actor.role !== Role.EMPLOYEE) {
      await createNotification({
        userId:  assigneeId,
        title:   'Task Approved & Completed',
        message: `Your work on task ${task.taskNo} has been approved and marked as completed.`,
        type:    'TASK_COMPLETED',
        link:    `/tasks/${id}`,
      });
    }
  }

  return updated;
}

// ─── TOGGLE an SOP step ──────────────────────────────────────────────────────
export async function toggleSOPStep(
  taskId: string,
  stepId: string,
  isCompleted: boolean,
  actor: { id: string; role: string }
) {
  await getTaskById(taskId, actor);

  const step = await prisma.taskSOPStep.findFirst({
    where: { id: stepId, taskId },
  });
  if (!step) throw new AppError('SOP step not found on this task', 404);

  // 1. Role-Based Check
  // Admins and Super Admins can toggle anything. 
  // Managers can toggle Manager/Employee steps. 
  // Employees can only toggle Employee steps.
  const roleHierarchy: Record<string, number> = { 'EMPLOYEE': 1, 'MANAGER': 2, 'ADMIN': 3, 'SUPER_ADMIN': 4 };
  const userRank = roleHierarchy[actor.role] || 0;
  const stepRank = roleHierarchy[step.assignedRole] || 0;

  if (userRank < stepRank && actor.role !== 'SUPER_ADMIN') {
    throw new AppError(`Access Denied: This step requires ${step.assignedRole} role.`, 403);
  }

  // 2. Step Lock Logic (Sequential Execution)
  if (isCompleted) {
    const previousStep = await prisma.taskSOPStep.findFirst({
      where: { 
        taskId, 
        order: { lt: step.order } 
      },
      orderBy: { order: 'desc' }
    });

    if (previousStep && !previousStep.isCompleted) {
      throw new AppError(`Workflow Lock: Please complete the previous step "${previousStep.title}" first.`, 400);
    }
  } else {
    // If unchecking, ensure no FUTURE step is already completed
    const nextStep = await prisma.taskSOPStep.findFirst({
      where: { 
        taskId, 
        order: { gt: step.order },
        isCompleted: true
      },
      orderBy: { order: 'asc' }
    });

    if (nextStep) {
      throw new AppError(`Workflow Lock: Cannot undo "${step.title}" because the next step "${nextStep.title}" is already completed.`, 400);
    }
  }

  const updated = await prisma.taskSOPStep.update({
    where: { id: stepId },
    data: { 
      isCompleted, 
      completedAt: isCompleted ? new Date() : null 
    },
  });

  await createLog({
    userId: actor.id,
    taskId,
    action: isCompleted ? 'SOP_STEP_COMPLETED' : 'SOP_STEP_UNDO',
    message: `Step "${step.title}" marked ${isCompleted ? 'complete' : 'incomplete'}`,
  });

  // ─── Automated Status Transitions ──────────────────────────────────────────
  const totalSteps = await prisma.taskSOPStep.count({ where: { taskId } });
  const completedSteps = await prisma.taskSOPStep.count({ where: { taskId, isCompleted: true } });
  
  if (completedSteps === totalSteps && totalSteps > 0) {
    // 100% Done -> Pending Approval
    await updateTask(taskId, { status: TaskStatus.PENDING_FOR_APPROVAL }, actor);
  } else if (completedSteps > 0) {
    // 1% - 99% Done -> In Progress
    await updateTask(taskId, { status: TaskStatus.WORK_IN_PROGRESS }, actor);
  } else if (completedSteps === 0 && totalSteps > 0) {
    // 0% Done -> Not Started (if it was WIP or Pending)
    const currentTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (currentTask?.status === TaskStatus.WORK_IN_PROGRESS || currentTask?.status === TaskStatus.PENDING_FOR_APPROVAL) {
      await updateTask(taskId, { status: TaskStatus.NOT_YET_STARTED }, actor);
    }
  }

  return updated;
}

// ─── COMPLETE an SOP step (Deprecated in favor of toggle) ─────────────────────
export async function completeSOPStep(
  taskId: string,
  stepId: string,
  actor: { id: string; role: string }
) {
  return toggleSOPStep(taskId, stepId, true, actor);
}

// ─── UNDO an SOP step (Deprecated in favor of toggle) ─────────────────────────
export async function undoSOPStep(
  taskId: string,
  stepId: string,
  actor: { id: string; role: string }
) {
  return toggleSOPStep(taskId, stepId, false, actor);
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
  if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
    throw new AppError(
      'Access Denied: You do not have sufficient permissions to delete tasks. This action is restricted to Admins and Super Admins.', 
      403
    );
  }

  await getTaskById(id, actor);
  return prisma.task.delete({ where: { id } });
}
