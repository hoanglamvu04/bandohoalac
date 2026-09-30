import { Router } from 'express';
import { listMissions } from '../controllers/missions.controller.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuthenticate, listMissions);

export default router;
