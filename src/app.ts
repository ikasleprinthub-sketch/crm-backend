import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';

// ─── Route imports ─────────────────────────────────────────────────────────────
import authRoutes        from './modules/auth/auth.routes';
import usersRoutes       from './modules/users/users.routes';
import leadsRoutes       from './modules/leads/leads.routes';
import tasksRoutes       from './modules/tasks/tasks.routes';
import departmentsRoutes from './modules/departments/departments.routes';
import taskTypesRoutes   from './modules/taskTypes/taskTypes.routes';
import sourcesRoutes     from './modules/sources/sources.routes';
import sopRoutes         from './modules/sop/sop.routes';
import activityRoutes    from './modules/activity/activity.routes';
import commentsRoutes    from './modules/comments/comments.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import attendanceRoutes    from './modules/attendance/attendance.routes';
import intelligenceRoutes  from './modules/intelligence/intelligence.routes';
import notesRoutes         from './modules/notes/notes.routes';

const app = express();

// ─── Security ───────────────────────────────────────────────────────────────── //
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

if (env.NODE_ENV === 'production') {
  app.use(limiter);
}

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

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
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/users',       usersRoutes);
app.use('/api/leads',       leadsRoutes);
app.use('/api/tasks',       tasksRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/task-types',  taskTypesRoutes);
app.use('/api/sources',     sourcesRoutes);
app.use('/api/sop',         sopRoutes);
app.use('/api/activity',    activityRoutes);
app.use('/api/comments',    commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/attendance',   attendanceRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/notes',        notesRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
