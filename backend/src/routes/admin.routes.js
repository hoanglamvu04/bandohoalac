import { Router } from 'express';
import { getContributions, getContribution, approve, reject } from '../controllers/admin.controller.js';
import { authenticate, authorize, requireCtvLevel } from '../middleware/auth.js';
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
  updateUserAdmin,
  updateUserReputationControlAdmin
} from '../controllers/adminUsers.controller.js';
import {
  adminAdjustWalletSchema,
  adminAssignPartnerAccessSchema,
  adminReputationControlSchema,
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
import { listClaimsAdmin, reviewClaimAdmin } from '../controllers/placeClaims.controller.js';
import { reviewPlaceClaimSchema } from '../validators/placeClaim.validators.js';
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
import {
  approvePhotoCandidateAdmin,
  getPhotoScannerStatsAdmin,
  listPhotoCandidatesAdmin,
  listPhotoScanRunsAdmin,
  rejectPhotoCandidateAdmin,
  startPhotoScanAdmin
} from '../controllers/adminPhotoScanner.controller.js';
import {
  deleteIntegrationAdmin,
  listIntegrationsAdmin,
  saveIntegrationAdmin,
  testIntegrationAdmin
} from '../controllers/adminIntegrations.controller.js';
import {
  auditCtvModerationAdmin,
  getDataQualityAdmin,
  listPlaceRevisionsAdmin,
  rollbackPlaceRevisionAdmin,
  verifyPlaceQualityAdmin
} from '../controllers/adminDataTrust.controller.js';

const router = Router();
const ctvStaff = authorize('CTV', 'MODERATOR', 'ADMIN');
const dataStaff = authorize('MODERATOR', 'ADMIN');
const adminOnly = authorize('ADMIN');

router.use(authenticate);

router.get('/contributions', ctvStaff, getContributions);
router.get('/contributions/:id', ctvStaff, getContribution);
router.post('/contributions/:id/approve', ctvStaff, approve);
router.post('/contributions/:id/reject', ctvStaff, validateBody(rejectContributionSchema), reject);
router.post('/contributions/:id/ctv-audit', adminOnly, auditCtvModerationAdmin);

router.get('/data-quality', ctvStaff, getDataQualityAdmin);
router.get('/places/:id/revisions', ctvStaff, listPlaceRevisionsAdmin);
router.post('/places/:id/verify-quality', ctvStaff, requireCtvLevel(2), verifyPlaceQualityAdmin);
router.post('/places/:id/revisions/:revisionId/rollback', dataStaff, rollbackPlaceRevisionAdmin);

router.get('/place-imports', ctvStaff, requireCtvLevel(2), listPlaceImportsAdmin);
router.get('/place-imports/runs', ctvStaff, requireCtvLevel(2), listPlaceImportRunsAdmin);
router.get('/place-imports/stats', ctvStaff, requireCtvLevel(2), getPlaceImportStatsAdmin);
router.patch('/place-imports/:id', ctvStaff, requireCtvLevel(2), updatePlaceImportAdmin);
router.post('/place-imports/:id/approve', ctvStaff, requireCtvLevel(2), approvePlaceImportAdmin);
router.post('/place-imports/:id/reject', ctvStaff, requireCtvLevel(2), rejectPlaceImportAdmin);
router.post('/place-imports/scan', adminOnly, startOverturePlaceScanAdmin);
router.post('/place-imports/approve-high-confidence', adminOnly, approveHighConfidencePlaceImportsAdmin);

router.get('/photo-scanner', ctvStaff, requireCtvLevel(2), listPhotoCandidatesAdmin);
router.get('/photo-scanner/runs', ctvStaff, requireCtvLevel(2), listPhotoScanRunsAdmin);
router.get('/photo-scanner/stats', ctvStaff, requireCtvLevel(2), getPhotoScannerStatsAdmin);
router.post('/photo-scanner/scan', adminOnly, startPhotoScanAdmin);
router.post('/photo-scanner/:id/approve', ctvStaff, requireCtvLevel(2), approvePhotoCandidateAdmin);
router.post('/photo-scanner/:id/reject', ctvStaff, requireCtvLevel(2), rejectPhotoCandidateAdmin);

router.get('/places', ctvStaff, listPlacesAdmin);
router.get('/places/:id', ctvStaff, getPlaceAdmin);
router.post('/places', ctvStaff, requireCtvLevel(2), validateBody(adminCreatePlaceSchema), createPlaceAdmin);
router.patch('/places/:id', ctvStaff, requireCtvLevel(2), validateBody(adminUpdatePlaceSchema), updatePlaceAdmin);
router.post('/places/:id/images', ctvStaff, requireCtvLevel(2), uploadPhotos, uploadPlaceImagesAdmin);
router.post('/places/:id/images/:imageId/cover', ctvStaff, requireCtvLevel(2), makeCoverAdmin);
router.delete('/places/:id', dataStaff, archivePlaceAdmin);
router.delete('/places/:id/images/:imageId', dataStaff, deletePlaceImageAdmin);

router.get('/ads', adminOnly, listAdvertisementsAdmin);
router.post('/ads', adminOnly, validateBody(adminCreateAdvertisementSchema), createAdvertisementAdmin);
router.patch('/ads/:id', adminOnly, validateBody(adminUpdateAdvertisementSchema), updateAdvertisementAdmin);
router.delete('/ads/:id', adminOnly, archiveAdvertisementAdmin);
router.post('/ads/:id/image', adminOnly, uploadSingleImage, uploadAdvertisementImageAdmin);

router.get('/users', adminOnly, listUsersAdmin);
router.get('/users/:id', adminOnly, getUserAdmin);
router.patch('/users/:id', adminOnly, validateBody(adminUpdateUserSchema), updateUserAdmin);
router.post('/users/:id/wallet-adjustments', adminOnly, validateBody(adminAdjustWalletSchema), adjustUserWalletAdmin);
router.put('/users/:id/reputation-control', adminOnly, validateBody(adminReputationControlSchema), updateUserReputationControlAdmin);
router.post('/users/:id/partner-access', adminOnly, validateBody(adminAssignPartnerAccessSchema), assignPartnerAccessAdmin);
router.patch('/users/:id/partner-access/:membershipId', adminOnly, validateBody(adminUpdatePartnerAccessSchema), updatePartnerAccessAdmin);

router.get('/partners', adminOnly, listPartnersAdminController);
router.post('/partners', adminOnly, validateBody(adminCreatePartnerSchema), createPartnerAdminController);
router.patch('/partners/:id', adminOnly, validateBody(adminUpdatePartnerSchema), updatePartnerAdminController);

router.get('/vouchers', adminOnly, listVoucherCampaignsAdminController);
router.post('/vouchers', adminOnly, validateBody(adminCreateVoucherSchema), createVoucherCampaignAdminController);
router.patch('/vouchers/:id', adminOnly, validateBody(adminUpdateVoucherSchema), updateVoucherCampaignAdminController);
router.get('/voucher-redemptions', adminOnly, listVoucherRedemptionsAdminController);
router.post('/voucher-redemptions/:id/redeem', adminOnly, markVoucherRedeemedAdminController);

router.get('/settlements', adminOnly, listPartnerSettlementsAdmin);
router.post('/settlements', adminOnly, validateBody(adminCreateSettlementSchema), createPartnerSettlementAdmin);
router.post('/settlements/:id/paid', adminOnly, markPartnerSettlementPaidAdmin);

router.get('/place-claims', adminOnly, listClaimsAdmin);
router.post('/place-claims/:id/review', adminOnly, validateBody(reviewPlaceClaimSchema), reviewClaimAdmin);

router.get('/missions', adminOnly, listMissionsAdminController);
router.post('/missions', adminOnly, validateBody(createMissionSchema), createMissionAdminController);
router.patch('/missions/:id', adminOnly, validateBody(updateMissionSchema), updateMissionAdminController);

router.get('/audit', adminOnly, listAuditLogsAdmin);
router.get('/brand', adminOnly, getBrandAdmin);
router.patch('/brand', adminOnly, validateBody(adminUpdateBrandSettingsSchema), updateBrandAdmin);
router.post('/brand/assets', adminOnly, uploadSingleImage, uploadBrandAssetAdmin);
router.delete('/brand/assets/:id', adminOnly, deleteBrandAssetAdmin);

router.get('/integrations', adminOnly, listIntegrationsAdmin);
router.post('/integrations/:provider/test', adminOnly, testIntegrationAdmin);
router.put('/integrations/:provider', adminOnly, saveIntegrationAdmin);
router.delete('/integrations/:provider', adminOnly, deleteIntegrationAdmin);

router.get('/developer-api/overview', adminOnly, getDeveloperApiOverviewAdmin);
router.patch('/developer-api/settings', adminOnly, validateBody(updateDeveloperApiSettingsSchema), updateDeveloperApiSettingsAdmin);
router.get('/developer-api/clients', adminOnly, listDeveloperApiClientsAdmin);
router.post('/developer-api/clients', adminOnly, validateBody(createDeveloperApiClientSchema), createDeveloperApiClientAdmin);
router.patch('/developer-api/clients/:id', adminOnly, validateBody(updateDeveloperApiClientSchema), updateDeveloperApiClientAdmin);
router.get('/developer-api/keys', adminOnly, listDeveloperApiKeysAdmin);
router.post('/developer-api/keys', adminOnly, validateBody(createDeveloperApiKeySchema), createDeveloperApiKeyAdmin);
router.post('/developer-api/keys/:id/revoke', adminOnly, revokeDeveloperApiKeyAdmin);
router.get('/developer-api/endpoints', adminOnly, listDeveloperApiEndpointsAdmin);
router.patch('/developer-api/endpoints/:key', adminOnly, validateBody(updateDeveloperApiEndpointSchema), updateDeveloperApiEndpointAdmin);
router.get('/developer-api/logs', adminOnly, listDeveloperApiLogsAdmin);

export default router;
