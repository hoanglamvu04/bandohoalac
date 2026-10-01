import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  createBrandAsset,
  deleteBrandAsset,
  getBrandAsset,
  getBrandSettings,
  listBrandAssets,
  updateBrandSettings
} from '../services/brand.service.js';
import {
  deleteStoredAssets,
  storeUploadedFiles
} from '../services/storage.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

function storedAsset(asset) {
  if (!asset?.url || !asset?.storageProvider) return null;
  return {
    provider: asset.storageProvider,
    url: asset.url,
    publicId: asset.storagePublicId || undefined,
    filename: asset.storageFilename || undefined
  };
}

export const getBrandAdmin = asyncHandler(async (_req, res) => {
  const [settings, assets] = await Promise.all([
    getBrandSettings(),
    listBrandAssets()
  ]);

  res.json({ settings, assets });
});

export const updateBrandAdmin = asyncHandler(async (req, res) => {
  const before = await getBrandSettings();
  const settings = await updateBrandSettings(req.body, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'BRAND_SETTINGS_UPDATED',
    entityType: 'BRAND',
    entityId: 'settings',
    metadata: {
      before: {
        headerLogoAssetId: before.headerLogo?.id || null,
        compactLogoAssetId: before.compactLogo?.id || null,
        footerLogoAssetId: before.footerLogo?.id || null,
        faviconAssetId: before.favicon?.id || null,
        headerLogoDesktopWidth: before.headerLogoDesktopWidth,
        headerLogoMobileWidth: before.headerLogoMobileWidth,
        headerLogoCompactWidth: before.headerLogoCompactWidth,
        footerLogoDesktopWidth: before.footerLogoDesktopWidth,
        footerLogoMobileWidth: before.footerLogoMobileWidth
      },
      changes: req.body
    },
    ...auditContextFromRequest(req)
  });

  res.json(settings);
});

export const uploadBrandAssetAdmin = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Hãy chọn ảnh logo hoặc favicon.', 400);
  }

  const name = String(req.body?.name || '').trim();
  const assetType = String(req.body?.assetType || '').trim().toUpperCase();

  if (!name) throw new AppError('Nhập tên asset.', 400);
  if (name.length > 120) throw new AppError('Tên asset quá dài.', 400);
  if (!['LOGO', 'FAVICON'].includes(assetType)) {
    throw new AppError('Loại asset phải là LOGO hoặc FAVICON.', 400);
  }

  const assets = await storeUploadedFiles([req.file], {
    scope: 'branding',
    prefix: assetType === 'FAVICON' ? 'favicon' : 'logo'
  });

  const uploaded = assets[0];
  if (!uploaded) throw new AppError('Không thể tải asset thương hiệu.', 500);

  let item;
  try {
    item = await createBrandAsset({
      name,
      assetType,
      asset: uploaded,
      createdBy: req.user.id
    });
  } catch (error) {
    await deleteStoredAssets([uploaded]);
    throw error;
  }

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'BRAND_ASSET_UPLOADED',
    entityType: 'BRAND_ASSET',
    entityId: item.id,
    metadata: {
      name: item.name,
      assetType: item.assetType,
      url: item.url
    },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const deleteBrandAssetAdmin = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getBrandAsset(id);
  if (!existing) throw new AppError('Brand asset not found.', 404);

  const deleted = await deleteBrandAsset(id);
  const asset = storedAsset(deleted);
  if (asset) await deleteStoredAssets([asset]);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'BRAND_ASSET_DELETED',
    entityType: 'BRAND_ASSET',
    entityId: String(id),
    metadata: {
      name: existing.name,
      assetType: existing.assetType
    },
    ...auditContextFromRequest(req)
  });

  res.json({ ok: true, id: String(id) });
});
