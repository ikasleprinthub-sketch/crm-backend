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

    return tx.sOPTemplate.findUnique({
      where: { id: template!.id },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  });
}
