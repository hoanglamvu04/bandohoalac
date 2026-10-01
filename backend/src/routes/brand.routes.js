import { Router } from 'express';
import { getBrandSettingsPublic } from '../controllers/brand.controller.js';

const router = Router();

router.get('/', getBrandSettingsPublic);

export default router;
