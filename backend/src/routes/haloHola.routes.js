import { Router } from 'express';
import {
  readHaloPlaceMedia,
  readHaloSpot,
  removeHaloPost,
  syncHaloPost
} from '../controllers/haloHola.controller.js';

const router = Router();

router.get('/spots/:id', readHaloSpot);
router.get('/places/:placeId', readHaloPlaceMedia);
router.post('/posts', syncHaloPost);
router.delete('/posts/:externalPostId', removeHaloPost);

export default router;
