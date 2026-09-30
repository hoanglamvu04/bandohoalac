import { Router } from 'express';
import {
  listMyRewards,
  listRewards,
  redeemReward
} from '../controllers/rewards.controller.js';
import {
  authenticate,
  optionalAuthenticate
} from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuthenticate, listRewards);
router.get('/me', authenticate, listMyRewards);
router.post('/:id/redeem', authenticate, redeemReward);

export default router;
