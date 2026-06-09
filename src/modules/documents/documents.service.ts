import path from 'path';
import fs from 'fs';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { getUploadDir } from './upload.middleware';

// ─── Lead Documents ───────────────────────────────────────────────────────────

export async function getLeadDocuments(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, leadNo: true, leadName: true, clientId: true },
  });
  if (!lead) throw new AppError('Lead not found', 404);

  let siblings: { id: string; leadNo: string }[];

  if (lead.clientId) {
    // New system: all leads sharing the same Client record
    siblings = await prisma.lead.findMany({
      where: { clientId: lead.clientId },
      select: { id: true, leadNo: true },
    });
  } else {
    // Legacy: match by business name (for leads created before Client table)
    siblings = await prisma.lead.findMany({
      where: { leadName: { equals: lead.leadName, mode: 'insensitive' } },
      select: { id: true, leadNo: true },
    });
  }

  const siblingIds = siblings.map((s) => s.id);
  const docs = await prisma.leadDocument.findMany({
    where: { leadId: { in: siblingIds } },
    orderBy: { uploadedAt: 'desc' },
  });

  const leadNoMap = Object.fromEntries(siblings.map((s) => [s.id, s.leadNo]));
  return docs.map((d) => ({ ...d, fromLeadNo: leadNoMap[d.leadId] }));
}

export async function createLeadDocument(
  leadId: string,
  file: Express.Multer.File,
  category: DocumentCategory,
  uploadedById?: string,
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, clientId: true },
  });
  if (!lead) throw new AppError('Lead not found', 404);

  const folder = lead.clientId ?? leadId;

  return prisma.leadDocument.create({
    data: {
      leadId,
      clientId: lead.clientId ?? undefined,
      category,
      originalName: file.originalname,
      savedName: file.filename,
      filePath: `/uploads/${folder}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: uploadedById ?? null,
    },
  });
}

export async function deleteLeadDocument(docId: string) {
  const doc = await prisma.leadDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new AppError('Document not found', 404);

  // filePath stored as "/uploads/acme_corp" — strip leading /uploads/ to get subfolder
  const subFolder = doc.filePath.replace(/^\/uploads\//, '');
  const fullPath = path.join(getUploadDir(), subFolder, doc.savedName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  return prisma.leadDocument.delete({ where: { id: docId } });
}

// ─── Task Documents ───────────────────────────────────────────────────────────

export async function getTaskDocuments(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('Task not found', 404);

  return prisma.taskDocument.findMany({
    where: { taskId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function createTaskDocument(taskId: string, file: Express.Multer.File, uploadedById?: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, leadId: true, lead: { select: { clientId: true } } },
  });
  if (!task) throw new AppError('Task not found', 404);

  const folder = task.lead?.clientId ?? task.leadId;

  return prisma.taskDocument.create({
    data: {
      taskId,
      originalName: file.originalname,
      savedName: file.filename,
      filePath: `/uploads/${folder}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: uploadedById ?? null,
    },
  });
}

export async function deleteTaskDocument(docId: string) {
  const doc = await prisma.taskDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new AppError('Document not found', 404);

  const subFolder = doc.filePath.replace(/^\/uploads\//, '');
  const fullPath = path.join(getUploadDir(), subFolder, doc.savedName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  return prisma.taskDocument.delete({ where: { id: docId } });
}
