import { Router } from 'express';
import {
  getExploreArticle,
  listExplore
} from '../controllers/explore.controller.js';

const router = Router();

router.get('/', listExplore);
router.get('/:slug', getExploreArticle);

export default router;
