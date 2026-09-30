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
import {
  createPartnerAdminController,
  createVoucherCampaignAdminController,
  listPartnersAdminController,
  listVoucherCampaignsAdminController,
  listVoucherRedemptionsAdminController,
  markVoucherRedeemedAdminController,
  updatePartnerAdminController,
  updateVoucherCampaignAdminController
} from '../controllers/adminRewards.controller.js';
import {
  adminCreatePartnerSchema,
  adminCreateVoucherSchema,
  adminUpdatePartnerSchema,
  adminUpdateVoucherSchema
} from '../validators/reward.validators.js';
import {
  createMissionAdminController,
  listMissionsAdminController,
  updateMissionAdminController
} from '../controllers/missions.controller.js';
import {
  createMissionSchema,
  updateMissionSchema
} from '../validators/mission.validators.js';
import {
  listClaimsAdmin,
  reviewClaimAdmin
} from '../controllers/placeClaims.controller.js';
import {
  reviewPlaceClaimSchema
} from '../validators/placeClaim.validators.js';
import { listAuditLogsAdmin } from '../controllers/audit.controller.js';
import { previewGooglePlaceImportAdmin } from '../controllers/googlePlacesImport.controller.js';
import { googlePlaceImportPreviewSchema } from '../validators/googlePlacesImport.validators.js';

const router = Router();

router.use(authenticate, authorize('MODERATOR', 'ADMIN'));

router.get('/contributions', getContributions);
router.get('/contributions/:id', getContribution);
router.post('/contributions/:id/approve', approve);
router.post('/contributions/:id/reject', validateBody(rejectContributionSchema), reject);

router.get('/places', listPlacesAdmin);
router.post(
  '/places/google-import-preview',
  validateBody(googlePlaceImportPreviewSchema),
  previewGooglePlaceImportAdmin
);
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

router.get('/partners', authorize('ADMIN'), listPartnersAdminController);
router.post(
  '/partners',
  authorize('ADMIN'),
  validateBody(adminCreatePartnerSchema),
  createPartnerAdminController
);
router.patch(
  '/partners/:id',
  authorize('ADMIN'),
  validateBody(adminUpdatePartnerSchema),
  updatePartnerAdminController
);

router.get('/vouchers', authorize('ADMIN'), listVoucherCampaignsAdminController);
router.post(
  '/vouchers',
  authorize('ADMIN'),
  validateBody(adminCreateVoucherSchema),
  createVoucherCampaignAdminController
);
router.patch(
  '/vouchers/:id',
  authorize('ADMIN'),
  validateBody(adminUpdateVoucherSchema),
  updateVoucherCampaignAdminController
);

router.get('/voucher-redemptions', authorize('ADMIN'), listVoucherRedemptionsAdminController);
router.post(
  '/voucher-redemptions/:id/redeem',
  authorize('ADMIN'),
  markVoucherRedeemedAdminController
);

router.get('/place-claims', authorize('ADMIN'), listClaimsAdmin);
router.post(
  '/place-claims/:id/review',
  authorize('ADMIN'),
  validateBody(reviewPlaceClaimSchema),
  reviewClaimAdmin
);

router.get('/missions', authorize('ADMIN'), listMissionsAdminController);
router.post(
  '/missions',
  authorize('ADMIN'),
  validateBody(createMissionSchema),
  createMissionAdminController
);
router.patch(
  '/missions/:id',
  authorize('ADMIN'),
  validateBody(updateMissionSchema),
  updateMissionAdminController
);

router.get('/audit', authorize('ADMIN'), listAuditLogsAdmin);

export default router;
