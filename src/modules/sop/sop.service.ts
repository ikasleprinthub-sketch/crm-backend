import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export async function getTemplateByTaskType(taskTypeId: string) {
  const template = await prisma.sOPTemplate.findUnique({
    where: { taskTypeId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  return template;
}

export async function updateTemplateSteps(
  taskTypeId: string, 
  steps: { title: string; order: number; assignedRole?: any; deadlineHours?: number }[]
) {
  // 1. Ensure Task Type exists
  const taskType = await prisma.taskType.findUnique({ where: { id: taskTypeId } });
  if (!taskType) throw new AppError('Task Type not found', 404);

  // 2. Get or Create Template
  let template = await prisma.sOPTemplate.findUnique({ where: { taskTypeId } });
  if (!template) {
    template = await prisma.sOPTemplate.create({
      data: { taskTypeId }
    });
  }

  // 3. Atomic Update: Delete old steps and insert new ones
  // Using a transaction to ensure data integrity
  return prisma.$transaction(async (tx) => {
    await tx.sOPStep.deleteMany({ where: { templateId: template!.id } });
    
    if (steps.length > 0) {
      await tx.sOPStep.createMany({
        data: steps.map(s => ({
          title: s.title,
          order: s.order,
          assignedRole: s.assignedRole || 'EMPLOYEE',
          deadlineHours: s.deadlineHours || 0,
          templateId: template!.id
        }))
      });
    }
    const updatedTemplate = await tx.sOPTemplate.findUnique({
      where: { id: template!.id },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    // 4. Apply to existing tasks that have NO SOP steps
    // We use an explicit count check to ensure accuracy
    const allTasks = await tx.task.findMany({
      where: { taskTypeId },
      include: { _count: { select: { sopSteps: true } } }
    });

    const tasksToUpdate = allTasks.filter(t => t._count.sopSteps === 0);

    for (const task of tasksToUpdate) {
      if (steps.length > 0) {
        // Prepare steps with calculated due dates
        const stepsToCreate = steps.map(s => {
          const deadlineHours = s.deadlineHours || 0;
          let dueAt: Date | null = null;
          if (deadlineHours > 0) {
            dueAt = new Date();
            dueAt.setHours(dueAt.getHours() + deadlineHours);
          }

          return {
            taskId: task.id,
            title: s.title,
            order: s.order,
            assignedRole: s.assignedRole || 'EMPLOYEE',
            deadlineHours: deadlineHours,
            dueAt: dueAt,
            isCompleted: false
          };
        });

        await tx.taskSOPStep.createMany({ data: stepsToCreate });
      }
    }

    return updatedTemplate;
  });
}
