import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { LeadStatus } from '@prisma/client';
import { createNotification } from '../notifications/notifications.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function generateLeadNo(): Promise<string> {
  const count = await prisma.lead.count();
  return `LEAD-${String(count + 1).padStart(4, '0')}`;
}

const leadInclude = {
  source:     { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  taskType:   { select: { id: true, name: true } },
  tasks:      { select: { id: true, taskNo: true, status: true, priority: true } },
} as const;

// ─── GET all leads ────────────────────────────────────────────────────────────
export async function getAllLeads(opts: {
  page: number;
  limit: number;
  status?: LeadStatus;
  departmentId?: string;
  sourceId?: string;
  search?: string;
}) {
  const { page, limit, status, departmentId, sourceId, search } = opts;
  const skip = (page - 1) * limit;

  const where = {
    ...(status       ? { status }       : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(sourceId     ? { sourceId }     : {}),
    ...(search
      ? {
          OR: [
            { leadName:    { contains: search, mode: 'insensitive' as const } },
            { contactName: { contains: search, mode: 'insensitive' as const } },
            { email:       { contains: search, mode: 'insensitive' as const } },
            { leadNo:      { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: leadInclude,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ─── GET single lead ──────────────────────────────────────────────────────────
export async function getLeadById(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!lead) throw new AppError('Lead not found', 404);
  return lead;
}

// ─── CREATE lead ──────────────────────────────────────────────────────────────
export async function createLead(data: {
  date: string;
  sourceId: string;
  leadName: string;
  contactName?: string;
  contactNumber?: string;
  email?: string;
  departmentId: string;
  taskTypeId: string;
  remarks?: string;
}) {
  // Validate FKs
  const [src, dept, tt] = await Promise.all([
    prisma.sourceOfLead.findUnique({ where: { id: data.sourceId } }),
    prisma.department.findUnique({ where: { id: data.departmentId } }),
    prisma.taskType.findUnique({ where: { id: data.taskTypeId } }),
  ]);
  if (!src)  throw new AppError('Source not found', 404);
  if (!dept) throw new AppError('Department not found', 404);
  if (!tt)   throw new AppError('Task type not found', 404);

  const leadNo = await generateLeadNo();

  const leadDate = data.date ? new Date(data.date) : new Date();
  if (isNaN(leadDate.getTime())) {
    throw new AppError('Invalid date format provided for lead', 400);
  }

  return prisma.lead.create({
    data: {
      leadNo,
      date:          leadDate,
      sourceId:      data.sourceId,
      leadName:      data.leadName,
      contactName:   data.contactName,
      contactNumber: data.contactNumber,
      email:         data.email,
      departmentId:  data.departmentId,
      taskTypeId:    data.taskTypeId,
      remarks:       data.remarks,
    },
    include: leadInclude,
  });
}

// ─── UPDATE lead ──────────────────────────────────────────────────────────────
export async function updateLead(
  id: string,
  data: Partial<{
    date: string;
    sourceId: string;
    leadName: string;
    contactName: string;
    contactNumber: string;
    email: string;
    departmentId: string;
    taskTypeId: string;
    remarks: string;
    status: LeadStatus;
  }>
) {
  await getLeadById(id);
  return prisma.lead.update({
    where: { id },
    data: {
      ...data,
      date: data.date ? (() => {
        const d = new Date(data.date);
        if (isNaN(d.getTime())) throw new AppError('Invalid date format', 400);
        return d;
      })() : undefined,
    },
    include: leadInclude,
  });
}

// ─── CONVERT lead → task ──────────────────────────────────────────────────────
export async function convertLeadToTask(
  leadId: string,
  data: {
    assignedToId: string;
    remarks?: string;
    priority?: string;
    startDate?: string;
  },
  actorId: string
) {
  const lead = await getLeadById(leadId);

  if (lead.status === LeadStatus.CONVERTED) {
    throw new AppError('Lead is already converted', 400);
  }

  // Validate assignee
  const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
  if (!assignee) throw new AppError('Assigned user not found', 404);

  // Generate task number
  const taskCount = await prisma.task.count();
  const taskNo = `TASK-${String(taskCount + 1).padStart(4, '0')}`;

  // Fetch SOP template if exists
  const sopTemplate = await prisma.sOPTemplate.findUnique({
    where: { taskTypeId: lead.taskTypeId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  const task = await prisma.$transaction(async (tx) => {
    // Create task
    const newTask = await tx.task.create({
      data: {
        taskNo,
        leadId:        leadId,
        departmentId:  lead.departmentId,
        taskTypeId:    lead.taskTypeId,
        contactName:   lead.contactName,
        contactNumber: lead.contactNumber,
        email:         lead.email,
        assignedToId:  data.assignedToId,
        remarks:       data.remarks ?? lead.remarks,
        priority:      (data.priority as any) ?? 'REGULAR',
        startDate:     data.startDate ? (() => {
          const d = new Date(data.startDate);
          if (isNaN(d.getTime())) throw new AppError('Invalid start date format', 400);
          return d;
        })() : undefined,
        sopSteps: sopTemplate
          ? {
              create: sopTemplate.steps.map((s) => ({
                title: s.title,
                order: s.order,
              })),
            }
          : undefined,
      },
    });

    // Mark lead as CONVERTED
    await tx.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.CONVERTED },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        userId:  actorId,
        taskId:  newTask.id,
        action:  'LEAD_CONVERTED',
        message: `Lead ${lead.leadNo} converted to task ${taskNo} and assigned to ${assignee.name}`,
      },
    });

    // Notify assignee (Futuristic)
    await createNotification({
      userId:  data.assignedToId,
      title:   'New Task Assigned',
      message: `You have been assigned task ${taskNo} for ${lead.leadName}`,
      type:    'TASK_ASSIGNED',
      link:    `/tasks/${newTask.id}`,
    });

    return newTask;
  });

  return task;
}

// ─── DELETE lead ──────────────────────────────────────────────────────────────
export async function deleteLead(id: string) {
  const lead = await getLeadById(id);
  if (lead.status === LeadStatus.CONVERTED) {
    throw new AppError('Cannot delete a converted lead', 400);
  }
  return prisma.lead.delete({ where: { id } });
}
