import { Router } from 'express';
import { getProfile } from '../controllers/users.controller.js';

const router = Router();

router.get('/:id/profile', getProfile);

export default router;
