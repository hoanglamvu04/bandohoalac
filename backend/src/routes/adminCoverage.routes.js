import { Router } from 'express';
import { authenticate, authorize, requireAdminSecurity } from '../middleware/auth.js';
import {
  getCoverageCleanupAdmin,
  runCoverageCleanupAdmin
} from '../controllers/adminCoverageCleanup.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'), requireAdminSecurity);
router.get('/', getCoverageCleanupAdmin);
router.post('/run', runCoverageCleanupAdmin);

export default router;
