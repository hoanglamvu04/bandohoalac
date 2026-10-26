import { Router } from 'express';
import { authenticate, authorize, requireAdminSecurity } from '../middleware/auth.js';
import { getHaloSyncMonitorAdmin } from '../controllers/adminHaloSync.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'), requireAdminSecurity);
router.get('/', getHaloSyncMonitorAdmin);

export default router;
