import { Router } from 'express';
import { list, create, update, archive } from '../controllers/mapLayers.controller.js';
import { authenticate, authorize, requireAdminSecurity } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { createMapFeatureSchema, updateMapFeatureSchema } from '../validators/mapLayers.validators.js';

const router = Router();

router.get('/', list);
router.post('/', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, validateBody(createMapFeatureSchema), create);
router.patch('/:id', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, validateBody(updateMapFeatureSchema), update);
router.delete('/:id', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, archive);

export default router;
