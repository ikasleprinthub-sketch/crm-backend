import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { getUploadDir } from './modules/documents/upload.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware'; //hi

// ─── Route imports ─────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import leadsRoutes from './modules/leads/leads.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import departmentsRoutes from './modules/departments/departments.routes';
import taskTypesRoutes from './modules/taskTypes/taskTypes.routes';
import sourcesRoutes from './modules/sources/sources.routes';
import sopRoutes from './modules/sop/sop.routes';
import activityRoutes from './modules/activity/activity.routes';
import commentsRoutes from './modules/comments/comments.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import intelligenceRoutes from './modules/intelligence/intelligence.routes';
import notesRoutes from './modules/notes/notes.routes';
import configRoutes from './modules/config/config.routes';
import documentsRoutes from './modules/documents/documents.routes';

const app = express();

// ─── Security ───────────────────────────────────────────────────────────────── //
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    hsts: env.NODE_ENV === 'production', // Disable HSTS in dev to avoid HTTPS enforcement on localhost
  })
);
app.use(
  cors({
    origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Trust Proxy (required for correct client IP behind Nginx / Railway / Vercel) ─
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
import { standardLimiter } from './middleware/rateLimit.middleware';

if (env.NODE_ENV === 'production') {
  app.use(standardLimiter);
}

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ─── Static File Serving (Uploaded Documents) ─────────────────────────────────
// Uses UPLOAD_DIR env var on VPS, falls back to <project>/uploads in development
app.use('/uploads', express.static(getUploadDir()));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req) => req.url === '/health',
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'CRM API is running', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/task-types', taskTypesRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/sop', sopRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api', documentsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
