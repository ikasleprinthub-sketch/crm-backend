import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

// ─── GET all SOP templates ────────────────────────────────────────────────────
export async function getAllTemplates() {
  return prisma.sOPTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      taskType: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
      steps: { orderBy: { order: 'asc' } },
    },
  });
}

// ─── GET single SOP template ─────────────────────────────────────────────────
export async function getTemplateById(id: string) {
  const tpl = await prisma.sOPTemplate.findUnique({
    where: { id },
    include: {
      taskType: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
      steps: { orderBy: { order: 'asc' } },
    },
  });
  if (!tpl) throw new AppError('SOP template not found', 404);
  return tpl;
}

// ─── CREATE SOP template (with steps) ────────────────────────────────────────
export async function createTemplate(data: {
  taskTypeId: string;
  steps: { title: string; order: number }[];
}) {
  const tt = await prisma.taskType.findUnique({ where: { id: data.taskTypeId } });
  if (!tt) throw new AppError('Task type not found', 404);

  const existing = await prisma.sOPTemplate.findUnique({ where: { taskTypeId: data.taskTypeId } });
  if (existing) throw new AppError('SOP template already exists for this task type', 409);

  return prisma.sOPTemplate.create({
    data: {
      taskTypeId: data.taskTypeId,
      steps: {
        create: data.steps.map((s) => ({ title: s.title, order: s.order })),
      },
    },
    include: {
      taskType: { select: { id: true, name: true } },
      steps: { orderBy: { order: 'asc' } },
    },
  });
}

// ─── UPDATE template steps (replace all) ─────────────────────────────────────
export async function updateTemplateSteps(
  id: string,
  steps: { title: string; order: number }[]
) {
  await getTemplateById(id);

  // Delete old steps and replace
  await prisma.sOPStep.deleteMany({ where: { templateId: id } });

  const updated = await prisma.sOPTemplate.update({
    where: { id },
    data: {
      steps: {
        create: steps.map((s) => ({ title: s.title, order: s.order })),
      },
    },
    include: {
      taskType: { select: { id: true, name: true } },
      steps: { orderBy: { order: 'asc' } },
    },
  });

  return updated;
}

// ─── ADD a single step ────────────────────────────────────────────────────────
export async function addStep(templateId: string, data: { title: string; order: number }) {
  await getTemplateById(templateId);
  return prisma.sOPStep.create({ data: { templateId, title: data.title, order: data.order } });
}

// ─── DELETE a step ────────────────────────────────────────────────────────────
export async function deleteStep(stepId: string) {
  const step = await prisma.sOPStep.findUnique({ where: { id: stepId } });
  if (!step) throw new AppError('SOP step not found', 404);
  return prisma.sOPStep.delete({ where: { id: stepId } });
}

// ─── DELETE template ──────────────────────────────────────────────────────────
export async function deleteTemplate(id: string) {
  await getTemplateById(id);
  return prisma.sOPTemplate.delete({ where: { id } });
}
