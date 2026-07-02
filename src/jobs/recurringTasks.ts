import { prisma } from '../lib/prisma';
import { RecurrenceInterval } from '@prisma/client';

export async function checkRecurringTasks() {
  try {
    const now = new Date();
    // Find active configs where nextDueDate has arrived
    const dueConfigs = await prisma.recurringTaskConfig.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: now },
      },
      include: {
        lead: true,
        assignedTo: true,
      }
    });

    if (dueConfigs.length === 0) return;

    console.log(`⏱️ [Recurring Tasks Job] Found ${dueConfigs.length} due recurring task schedules.`);

    for (const config of dueConfigs) {
      const lead = config.lead;
      if (!lead) continue;

      await prisma.$transaction(async (tx) => {
        // Generate task number
        const taskCount = await tx.task.count();
        const taskNo = `TASK-${String(taskCount + 1).padStart(4, '0')}`;

        // Fetch SOP template
        const sopTemplate = await tx.sOPTemplate.findUnique({
          where: { taskTypeId: lead.taskTypeId },
          include: { steps: { orderBy: { order: 'asc' } } },
        });

        // Create automated task
        const newTask = await tx.task.create({
          data: {
            taskNo,
            leadId:        lead.id,
            departmentId:  lead.departmentId,
            taskTypeId:    lead.taskTypeId,
            contactName:   lead.contactName,
            contactNumber: lead.contactNumber,
            email:         lead.email,
            assignedToId:  config.assignedToId,
            remarks:       `[Auto-Recurring Return] ${config.remarks || lead.remarks || ''}`,
            priority:      'REGULAR',
            isAutomated:   true,
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

        // Advance nextDueDate
        let nextDueDate = new Date(config.nextDueDate);
        let isActive = true;

        if (config.interval === RecurrenceInterval.MONTHLY) {
          nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 1);
        } else if (config.interval === RecurrenceInterval.QUARTERLY) {
          const currentQuarter = Math.floor(nextDueDate.getMonth() / 3);
          nextDueDate = new Date(nextDueDate.getFullYear(), (currentQuarter + 1) * 3, 1);
        } else if (config.interval === RecurrenceInterval.YEARLY) {
          nextDueDate = new Date(nextDueDate.getFullYear() + 1, 0, 1);
        } else if (config.interval === RecurrenceInterval.CUSTOM) {
          // Custom recurrence is a one-time future task, so we disable it now
          isActive = false;
        }

        await tx.recurringTaskConfig.update({
          where: { id: config.id },
          data: {
            nextDueDate,
            isActive,
          },
        });

        // Log activity
        await tx.activityLog.create({
          data: {
            userId:  config.assignedToId,
            taskId:  newTask.id,
            action:  'TASK_RECURRED',
            message: `Automated recurring task ${taskNo} generated for client ${lead.leadName}`,
          },
        });

        // Create db notification
        await tx.notification.create({
          data: {
            userId:  config.assignedToId,
            title:   'New Automated Task',
            message: `Recurring task ${taskNo} has been automatically generated for ${lead.leadName}.`,
            isRead:  false,
            type:    'TASK_ASSIGNED',
            link:    `/tasks/${newTask.id}`,
          }
        });

        console.log(`✅ [Recurring Tasks Job] Generated task ${taskNo} for ${lead.leadName}. Next due date: ${isActive ? nextDueDate.toISOString() : 'INACTIVE'}`);
      });
    }
  } catch (error) {
    console.error('❌ [Recurring Tasks Job] Error checking/running recurring tasks:', error);
  }
}

export function startRecurringTasksJob() {
  console.log('⏱️ [Recurring Tasks Job] Starting recurring task checking daemon...');
  
  // Run check immediately on startup
  checkRecurringTasks();

  // Run check every 1 hour (3,600,000 ms)
  setInterval(() => {
    checkRecurringTasks();
  }, 60 * 60 * 1000);
}
