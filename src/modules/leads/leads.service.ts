import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { LeadStatus, RecurrenceInterval } from '@prisma/client';
import { createNotification } from '../notifications/notifications.service';
import { getConfig } from '../config/config.service';
import { emitGlobal } from '../../lib/socket';

// ─── Helpers ────────────────────────────────────────────────────────────────── //
async function generateLeadNo(): Promise<string> {
  const latestLead = await prisma.lead.findFirst({
    where: { leadNo: { startsWith: 'LEAD-' } },
    orderBy: { leadNo: 'desc' },
    select: { leadNo: true },
  });

  if (!latestLead?.leadNo) return 'LEAD-0001';

  const match = latestLead.leadNo.match(/LEAD-(\d+)/);
  if (match?.[1]) {
    return `LEAD-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
  }

  const count = await prisma.lead.count();
  return `LEAD-${String(count + 1).padStart(4, '0')}`;
}

const leadInclude = {
  source: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  taskType: { select: { id: true, name: true } },
  tasks: { select: { id: true, taskNo: true, status: true, priority: true } },
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
    ...(status ? { status } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(search
      ? {
        OR: [
          { leadName: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { leadNo: { contains: search, mode: 'insensitive' as const } },
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
  if (!src) throw new AppError('Source not found', 404);
  if (!dept) throw new AppError('Department not found', 404);
  if (!tt) throw new AppError('Task type not found', 404);

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

  const leadDate = data.date ? new Date(data.date) : new Date();
  if (isNaN(leadDate.getTime())) {
    throw new AppError('Invalid date format provided for lead', 400);
  }

  let lead;
  let attempts = 0;
  while (true) {
    const leadNo = await generateLeadNo();
    try {
      lead = await prisma.lead.create({
        data: {
          leadNo,
          date: leadDate,
          sourceId: data.sourceId,
          leadName: data.leadName,
          contactName: data.contactName,
          contactNumber: data.contactNumber,
          email: data.email,
          departmentId: data.departmentId,
          taskTypeId: data.taskTypeId,
          remarks: data.remarks,
        },
        include: leadInclude,
      });
      break;
    } catch (err: any) {
      if (err?.code === 'P2002' && err?.meta?.target?.includes('leadNo') && attempts < 3) {
        attempts++;
        continue;
      }
      throw err;
    }
  }

  emitGlobal('lead:updated', { action: 'create', lead });
  return lead;
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
  const updated = await prisma.lead.update({
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

  emitGlobal('lead:updated', { action: 'update', lead: updated });
  return updated;
}

// ─── CONVERT lead → task ──────────────────────────────────────────────────────
export async function convertLeadToTask(
  leadId: string,
  data: {
    assignedToId: string;
    remarks?: string;
    priority?: string;
    startDate?: string;
    recurrence?: {
      interval: RecurrenceInterval;
      nextDueDate?: string;
    };
  },
  actorId: string
) {
  const lead = await getLeadById(leadId);

  if (lead.status === LeadStatus.CONVERTED) {
    throw new AppError('Lead is already converted', 400);
  }

  const updatedLead = await prisma.$transaction(async (tx) => {
    // Mark lead as CONVERTED
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.CONVERTED },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: 'LEAD_CONVERTED',
        message: `Lead ${lead.leadNo} converted.`,
      },
    });

    // Create Recurrence Configuration if requested
    if (data.recurrence && data.recurrence.interval !== 'NONE' as any) {
      let nextDueDate = new Date();
      nextDueDate.setHours(0, 0, 0, 0); // Start of day

      if (data.recurrence.interval === 'MONTHLY') {
        nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 1);
      } else if (data.recurrence.interval === 'QUARTERLY') {
        const currentQuarter = Math.floor(nextDueDate.getMonth() / 3);
        nextDueDate = new Date(nextDueDate.getFullYear(), (currentQuarter + 1) * 3, 1);
      } else if (data.recurrence.interval === 'YEARLY') {
        nextDueDate = new Date(nextDueDate.getFullYear() + 1, 0, 1);
      } else if (data.recurrence.interval === 'CUSTOM') {
        if (!data.recurrence.nextDueDate) {
          throw new AppError('Custom next due date is required', 400);
        }
        nextDueDate = new Date(data.recurrence.nextDueDate);
        if (isNaN(nextDueDate.getTime())) {
          throw new AppError('Invalid custom next due date format', 400);
        }
      }

      const existingConfig = await tx.recurringTaskConfig.findUnique({
        where: { leadId },
      });

      if (existingConfig) {
        await tx.recurringTaskConfig.update({
          where: { leadId },
          data: {
            interval: data.recurrence.interval,
            nextDueDate,
            assignedToId: data.assignedToId,
            remarks: data.remarks,
            isActive: true,
          },
        });
      } else {
        await tx.recurringTaskConfig.create({
          data: {
            leadId,
            interval: data.recurrence.interval,
            nextDueDate,
            assignedToId: data.assignedToId,
            remarks: data.remarks,
          },
        });
      }
    }

    return updated;
  });

  emitGlobal('lead:updated', { action: 'convert', leadId });
  return updatedLead;
}

// ─── BULK IMPORT leads (NEW status) ──────────────────────────────────────────
export async function bulkImportLeads(
  rows: Array<{
    leadName: string;
    contactName?: string;
    contactNumber?: string;
    email?: string;
    sourceId: string;
    departmentId: string;
    taskTypeId: string;
    remarks?: string;
  }>
) {
  const results: Array<{
    row: number;
    leadName: string;
    status: 'success' | 'error';
    leadNo?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const lead = await createLead({
        date: new Date().toISOString(),
        sourceId: row.sourceId,
        leadName: row.leadName,
        contactName: row.contactName,
        contactNumber: row.contactNumber,
        email: row.email ? row.email.trim().toLowerCase() : undefined,
        departmentId: row.departmentId,
        taskTypeId: row.taskTypeId,
        remarks: row.remarks,
      });
      results.push({ row: i + 1, leadName: row.leadName, status: 'success', leadNo: lead.leadNo });
    } catch (err: any) {
      results.push({ row: i + 1, leadName: row.leadName, status: 'error', error: err.message || 'Unknown error' });
    }
  }

  const summary = {
    total: rows.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
  };

  return { results, summary };
}

// ─── DELETE lead ──────────────────────────────────────────────────────────────
export async function deleteLead(id: string, actorRole: string) {
  console.log(`[LeadsService] deleteLead called for ID: ${id} by Role: ${actorRole}`);

  // Strict Permission Check: Only Super Admin and Admin can delete leads
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
    console.log(`[LeadsService] Blocked: Lead deletion attempt by unauthorized role (${actorRole})`);
    throw new AppError(
      'Access Denied: You do not have sufficient permissions to delete lead records. This action is restricted to Admins and Super Admins.',
      403
    );
  }


  const lead = await getLeadById(id);

  try {
    return await prisma.$transaction(async (tx) => {
      // Find all tasks associated with this lead
      const tasks = await tx.task.findMany({
        where: { leadId: id },
        select: { id: true }
      });

      if (tasks.length > 0) {
        console.log(`[LeadsService] Found ${tasks.length} tasks linked to lead ${id}. Cascading deletion...`);
        const taskIds = tasks.map(t => t.id);

        // 1. Nullify task references in activity logs (preserving the logs)
        await tx.activityLog.updateMany({
          where: { taskId: { in: taskIds } },
          data: { taskId: null }
        });

        // 2. Delete associated tasks (Comments and SOPSteps cascade in DB)
        await tx.task.deleteMany({
          where: { leadId: id }
        });
      }

      // 3. Delete the lead itself
      const result = await tx.lead.delete({ where: { id } });
      console.log(`[LeadsService] Lead ${id} deleted successfully.`);
      emitGlobal('lead:updated', { action: 'delete', id });
      emitGlobal('task:updated', { action: 'delete_associated_with_lead', leadId: id });
      return result;
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    console.error(`[LeadsService] Error deleting lead ${id}:`, error.message);
    throw error;
  }
}

