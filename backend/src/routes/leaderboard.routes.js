import { Router } from 'express';
import { getLeaderboardHandler } from '../controllers/leaderboard.controller.js';

const router = Router();

router.get('/', getLeaderboardHandler);

export default router;
