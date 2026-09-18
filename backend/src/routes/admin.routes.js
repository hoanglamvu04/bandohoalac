import { Router } from 'express';
import { getContributions, getContribution, approve, reject } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { rejectContributionSchema } from '../validators/admin.validators.js';

const router = Router();

router.use(authenticate, authorize('MODERATOR', 'ADMIN'));

router.get('/contributions', getContributions);
router.get('/contributions/:id', getContribution);
router.post('/contributions/:id/approve', approve);
router.post('/contributions/:id/reject', validateBody(rejectContributionSchema), reject);

export default router;
