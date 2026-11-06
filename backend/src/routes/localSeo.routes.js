import { Router } from 'express';
import { getPublicLocalSeoData } from '../controllers/localSeo.controller.js';

const router = Router();

router.get('/:slug', getPublicLocalSeoData);

export default router;
