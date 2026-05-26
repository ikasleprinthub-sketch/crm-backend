import path from 'path';
import fs from 'fs';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { getUploadDir } from './upload.middleware';

// ─── Lead Documents ───────────────────────────────────────────────────────────

export async function getLeadDocuments(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  return prisma.leadDocument.findMany({
    where: { leadId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function createLeadDocument(
  leadId: string,
  file: Express.Multer.File,
  category: DocumentCategory
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  return prisma.leadDocument.create({
    data: {
      leadId,
      category,
      originalName: file.originalname,
      savedName: file.filename,
      filePath: `/uploads/customers/${leadId}`,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
}

export async function deleteLeadDocument(docId: string) {
  const doc = await prisma.leadDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new AppError('Document not found', 404);

  const fullPath = path.join(getUploadDir(), 'customers', doc.leadId, doc.savedName);
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

export async function createTaskDocument(taskId: string, file: Express.Multer.File) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('Task not found', 404);

  return prisma.taskDocument.create({
    data: {
      taskId,
      originalName: file.originalname,
      savedName: file.filename,
      filePath: `/uploads/tasks/${taskId}`,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
}

export async function deleteTaskDocument(docId: string) {
  const doc = await prisma.taskDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new AppError('Document not found', 404);

  const fullPath = path.join(getUploadDir(), 'tasks', doc.taskId, doc.savedName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  return prisma.taskDocument.delete({ where: { id: docId } });
}
