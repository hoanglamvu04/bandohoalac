import { Router } from 'express';
import { getContributions, getContribution, approve, reject } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { rejectContributionSchema } from '../validators/admin.validators.js';
import {
  archivePlaceAdmin,
  createPlaceAdmin,
  deletePlaceImageAdmin,
  getPlaceAdmin,
  listPlacesAdmin,
  makeCoverAdmin,
  updatePlaceAdmin,
  uploadPlaceImagesAdmin
} from '../controllers/adminPlaces.controller.js';
import {
  adminCreatePlaceSchema,
  adminUpdatePlaceSchema
} from '../validators/adminPlace.validators.js';
import { uploadPhotos, uploadSingleImage } from '../middleware/upload.js';
import {
  archiveAdvertisementAdmin,
  createAdvertisementAdmin,
  listAdvertisementsAdmin,
  updateAdvertisementAdmin,
  uploadAdvertisementImageAdmin
} from '../controllers/adminAdvertisements.controller.js';
import {
  adminCreateAdvertisementSchema,
  adminUpdateAdvertisementSchema
} from '../validators/advertisement.validators.js';
import {
  adjustUserWalletAdmin,
  getUserAdmin,
  listUsersAdmin,
  updateUserAdmin
} from '../controllers/adminUsers.controller.js';
import {
  adminAdjustWalletSchema,
  adminUpdateUserSchema
} from '../validators/adminUser.validators.js';

const router = Router();

router.use(authenticate, authorize('MODERATOR', 'ADMIN'));

router.get('/contributions', getContributions);
router.get('/contributions/:id', getContribution);
router.post('/contributions/:id/approve', approve);
router.post('/contributions/:id/reject', validateBody(rejectContributionSchema), reject);

router.get('/places', listPlacesAdmin);
router.post('/places', validateBody(adminCreatePlaceSchema), createPlaceAdmin);
router.get('/places/:id', getPlaceAdmin);
router.patch('/places/:id', validateBody(adminUpdatePlaceSchema), updatePlaceAdmin);
router.delete('/places/:id', archivePlaceAdmin);
router.post('/places/:id/images', uploadPhotos, uploadPlaceImagesAdmin);
router.post('/places/:id/images/:imageId/cover', makeCoverAdmin);
router.delete('/places/:id/images/:imageId', deletePlaceImageAdmin);

router.get('/ads', authorize('ADMIN'), listAdvertisementsAdmin);
router.post(
  '/ads',
  authorize('ADMIN'),
  validateBody(adminCreateAdvertisementSchema),
  createAdvertisementAdmin
);
router.patch(
  '/ads/:id',
  authorize('ADMIN'),
  validateBody(adminUpdateAdvertisementSchema),
  updateAdvertisementAdmin
);
router.delete('/ads/:id', authorize('ADMIN'), archiveAdvertisementAdmin);
router.post(
  '/ads/:id/image',
  authorize('ADMIN'),
  uploadSingleImage,
  uploadAdvertisementImageAdmin
);

router.get('/users', authorize('ADMIN'), listUsersAdmin);
router.get('/users/:id', authorize('ADMIN'), getUserAdmin);
router.patch(
  '/users/:id',
  authorize('ADMIN'),
  validateBody(adminUpdateUserSchema),
  updateUserAdmin
);
router.post(
  '/users/:id/wallet-adjustments',
  authorize('ADMIN'),
  validateBody(adminAdjustWalletSchema),
  adjustUserWalletAdmin
);

export default router;
