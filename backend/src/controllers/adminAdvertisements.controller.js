import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  archiveAd,
  createAd,
  getAdById,
  listAdminAds,
  setAdImage,
  updateAd
} from '../services/advertisement.service.js';
import {
  deleteStoredAssets,
  storeUploadedFiles
} from '../services/storage.service.js';

function storedAssetFromAd(ad) {
  if (!ad?.imageUrl || !ad?.imageStorageProvider) return null;
  return {
    provider: ad.imageStorageProvider,
    url: ad.imageUrl,
    publicId: ad.imageStoragePublicId || undefined,
    filename: ad.imageStorageFilename || undefined
  };
}

export const listAdvertisementsAdmin = asyncHandler(async (_req, res) => {
  const items = await listAdminAds();
  res.json({ items });
});

export const createAdvertisementAdmin = asyncHandler(async (req, res) => {
  const item = await createAd({
    ...req.body,
    createdBy: req.user.id
  });
  res.status(201).json(item);
});

export const updateAdvertisementAdmin = asyncHandler(async (req, res) => {
  const adId = Number(req.params.id);
  const existing = await getAdById(adId);
  if (!existing) throw new AppError('Advertisement not found.', 404);

  const item = await updateAd(adId, req.body);
  res.json(item);
});

export const archiveAdvertisementAdmin = asyncHandler(async (req, res) => {
  const adId = Number(req.params.id);
  const existing = await getAdById(adId);
  if (!existing) throw new AppError('Advertisement not found.', 404);

  const item = await archiveAd(adId);
  res.json(item);
});

export const uploadAdvertisementImageAdmin = asyncHandler(async (req, res) => {
  const adId = Number(req.params.id);
  const existing = await getAdById(adId);
  if (!existing) throw new AppError('Advertisement not found.', 404);
  if (!req.file) throw new AppError('Please select a banner image.', 400);

  const assets = await storeUploadedFiles([req.file], {
    scope: 'advertisements',
    prefix: 'ad-' + adId
  });
  const nextAsset = assets[0];
  if (!nextAsset) throw new AppError('Banner upload failed.', 500);

  let item;
  try {
    item = await setAdImage(adId, nextAsset);
  } catch (error) {
    await deleteStoredAssets([nextAsset]);
    throw error;
  }

  const oldAsset = storedAssetFromAd(existing);
  if (oldAsset) {
    await deleteStoredAssets([oldAsset]);
  }

  res.status(201).json(item);
});
