import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listMine,
  markAllRead,
  markRead
} from '../controllers/notifications.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', listMine);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

export default router;
