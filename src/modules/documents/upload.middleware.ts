import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';

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

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError('File type not allowed. Only PDF, JPG, PNG, WEBP accepted.', 400) as any);
  }
  cb(null, true);
}

export const leadUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(getUploadDir(), 'customers', req.params.leadId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
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
    destination: (req, _file, cb) => {
      const dir = path.join(getUploadDir(), 'tasks', req.params.taskId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
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
