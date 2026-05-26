import { Router } from 'express';
import * as ctrl from './documents.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { handleLeadUpload, handleTaskUpload } from './upload.middleware';

const router = Router();

router.use(authenticate);

// ─── Lead (Customer) Documents ─────────────────────────────────────────────
router.get('/leads/:leadId/documents', ctrl.getLeadDocs);
router.post('/leads/:leadId/documents', handleLeadUpload, ctrl.uploadLeadDoc);
router.delete('/lead-documents/:id', ctrl.deleteLeadDoc);

// ─── Task Documents ────────────────────────────────────────────────────────
router.get('/tasks/:taskId/documents', ctrl.getTaskDocs);
router.post('/tasks/:taskId/documents', handleTaskUpload, ctrl.uploadTaskDoc);
router.delete('/task-documents/:id', ctrl.deleteTaskDoc);

export default router;
