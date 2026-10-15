import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getHaloSyncMonitorAdmin } from '../controllers/adminHaloSync.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));
router.get('/', getHaloSyncMonitorAdmin);

export default router;
