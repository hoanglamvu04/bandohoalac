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
  assignPartnerAccessAdmin,
  getUserAdmin,
  listUsersAdmin,
  updatePartnerAccessAdmin,
  updateUserAdmin
} from '../controllers/adminUsers.controller.js';
import {
  adminAdjustWalletSchema,
  adminAssignPartnerAccessSchema,
  adminUpdatePartnerAccessSchema,
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
  adminCreateSettlementSchema,
  adminCreateVoucherSchema,
  adminUpdatePartnerSchema,
  adminUpdateVoucherSchema
} from '../validators/reward.validators.js';
import {
  createPartnerSettlementAdmin,
  listPartnerSettlementsAdmin,
  markPartnerSettlementPaidAdmin
} from '../controllers/adminSettlements.controller.js';
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
import {
  deleteBrandAssetAdmin,
  getBrandAdmin,
  updateBrandAdmin,
  uploadBrandAssetAdmin
} from '../controllers/adminBrand.controller.js';
import { adminUpdateBrandSettingsSchema } from '../validators/brand.validators.js';
import {
  createDeveloperApiClientAdmin,
  createDeveloperApiKeyAdmin,
  getDeveloperApiOverviewAdmin,
  listDeveloperApiClientsAdmin,
  listDeveloperApiEndpointsAdmin,
  listDeveloperApiKeysAdmin,
  listDeveloperApiLogsAdmin,
  revokeDeveloperApiKeyAdmin,
  updateDeveloperApiClientAdmin,
  updateDeveloperApiEndpointAdmin,
  updateDeveloperApiSettingsAdmin
} from '../controllers/adminDeveloperApi.controller.js';
import {
  createDeveloperApiClientSchema,
  createDeveloperApiKeySchema,
  updateDeveloperApiClientSchema,
  updateDeveloperApiEndpointSchema,
  updateDeveloperApiSettingsSchema
} from '../validators/developerApi.validators.js';
import {
  approveHighConfidencePlaceImportsAdmin,
  approvePlaceImportAdmin,
  getPlaceImportStatsAdmin,
  listPlaceImportRunsAdmin,
  listPlaceImportsAdmin,
  rejectPlaceImportAdmin,
  startOverturePlaceScanAdmin,
  updatePlaceImportAdmin
} from '../controllers/adminPlaceImports.controller.js';

const router = Router();

router.use(authenticate, authorize('MODERATOR', 'ADMIN'));

router.get('/contributions', getContributions);
router.get('/contributions/:id', getContribution);
router.post('/contributions/:id/approve', approve);
router.post('/contributions/:id/reject', validateBody(rejectContributionSchema), reject);

router.get('/place-imports', listPlaceImportsAdmin);
router.get('/place-imports/runs', listPlaceImportRunsAdmin);
router.post(
  '/place-imports/scan',
  authorize('ADMIN'),
  startOverturePlaceScanAdmin
);
router.get('/place-imports/stats', getPlaceImportStatsAdmin);
router.patch('/place-imports/:id', updatePlaceImportAdmin);
router.post('/place-imports/:id/approve', approvePlaceImportAdmin);
router.post('/place-imports/:id/reject', rejectPlaceImportAdmin);
router.post(
  '/place-imports/approve-high-confidence',
  authorize('ADMIN'),
  approveHighConfidencePlaceImportsAdmin
);

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

router.post(
  '/users/:id/partner-access',
  authorize('ADMIN'),
  validateBody(adminAssignPartnerAccessSchema),
  assignPartnerAccessAdmin
);

router.patch(
  '/users/:id/partner-access/:membershipId',
  authorize('ADMIN'),
  validateBody(adminUpdatePartnerAccessSchema),
  updatePartnerAccessAdmin
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

router.get('/settlements', authorize('ADMIN'), listPartnerSettlementsAdmin);
router.post(
  '/settlements',
  authorize('ADMIN'),
  validateBody(adminCreateSettlementSchema),
  createPartnerSettlementAdmin
);
router.post(
  '/settlements/:id/paid',
  authorize('ADMIN'),
  markPartnerSettlementPaidAdmin
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

router.get('/brand', authorize('ADMIN'), getBrandAdmin);
router.patch(
  '/brand',
  authorize('ADMIN'),
  validateBody(adminUpdateBrandSettingsSchema),
  updateBrandAdmin
);
router.post(
  '/brand/assets',
  authorize('ADMIN'),
  uploadSingleImage,
  uploadBrandAssetAdmin
);
router.delete(
  '/brand/assets/:id',
  authorize('ADMIN'),
  deleteBrandAssetAdmin
);


router.get('/developer-api/overview', authorize('ADMIN'), getDeveloperApiOverviewAdmin);
router.patch('/developer-api/settings', authorize('ADMIN'), validateBody(updateDeveloperApiSettingsSchema), updateDeveloperApiSettingsAdmin);
router.get('/developer-api/clients', authorize('ADMIN'), listDeveloperApiClientsAdmin);
router.post('/developer-api/clients', authorize('ADMIN'), validateBody(createDeveloperApiClientSchema), createDeveloperApiClientAdmin);
router.patch('/developer-api/clients/:id', authorize('ADMIN'), validateBody(updateDeveloperApiClientSchema), updateDeveloperApiClientAdmin);
router.get('/developer-api/keys', authorize('ADMIN'), listDeveloperApiKeysAdmin);
router.post('/developer-api/keys', authorize('ADMIN'), validateBody(createDeveloperApiKeySchema), createDeveloperApiKeyAdmin);
router.post('/developer-api/keys/:id/revoke', authorize('ADMIN'), revokeDeveloperApiKeyAdmin);
router.get('/developer-api/endpoints', authorize('ADMIN'), listDeveloperApiEndpointsAdmin);
router.patch('/developer-api/endpoints/:key', authorize('ADMIN'), validateBody(updateDeveloperApiEndpointSchema), updateDeveloperApiEndpointAdmin);
router.get('/developer-api/logs', authorize('ADMIN'), listDeveloperApiLogsAdmin);

export default router;
