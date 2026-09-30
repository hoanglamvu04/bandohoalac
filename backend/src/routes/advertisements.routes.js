import { Router } from 'express';
import {
  hideAdvertisementsToday,
  listAdvertisements
} from '../controllers/advertisement.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuthenticate, listAdvertisements);
router.post('/hide-today', authenticate, hideAdvertisementsToday);

export default router;
