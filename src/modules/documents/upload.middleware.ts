import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Resolve base upload directory.
// Production (VPS): env.UPLOAD_DIR = /var/www/uploads
// Development:      env.UPLOAD_DIR = '' → falls back to <project-root>/uploads
export function getUploadDir(): string {
  return env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

// Converts any lead/business name into a safe folder name.
// e.g. "Acme & Co. Ltd!" → "acme_co_ltd"
export function sanitizeFolderName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError('File type not allowed. Only PDF, JPG, PNG, WEBP accepted.', 400) as any);
  }
  cb(null, true);
}

export const leadUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: req.params.leadId },
          select: { clientId: true },
        });
        // Use clientId folder if available (new leads), fall back to leadId (legacy)
        const folder = lead?.clientId ?? req.params.leadId;
        const dir = path.join(getUploadDir(), folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('file');

export const taskUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const task = await prisma.task.findUnique({
          where: { id: req.params.taskId },
          select: { leadId: true, lead: { select: { clientId: true } } },
        });
        // Use clientId folder if available, fall back to leadId (legacy)
        const folder = task?.lead?.clientId ?? task?.leadId ?? req.params.taskId;
        const dir = path.join(getUploadDir(), folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('file');

function wrapUpload(uploadFn: (req: Request, res: Response, cb: (err: any) => void) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadFn(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('File must be under 10 MB.', 400));
        return next(new AppError(err.message, 400));
      }
      next(err);
    });
  };
}

export const handleLeadUpload = wrapUpload(leadUpload);
export const handleTaskUpload = wrapUpload(taskUpload);
