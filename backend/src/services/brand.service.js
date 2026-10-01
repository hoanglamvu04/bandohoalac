import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

const DEFAULTS = {
  headerLogoDesktopWidth: 198,
  headerLogoMobileWidth: 154,
  headerLogoCompactWidth: 38,
  footerLogoDesktopWidth: 178,
  footerLogoMobileWidth: 154
};

function mapAsset(row, prefix = '') {
  if (!row) return null;
  const get = (key) => row[prefix + key];

  if (!get('id')) return null;

  return {
    id: String(get('id')),
    name: get('name'),
    assetType: get('asset_type'),
    url: get('url'),
    storageProvider: get('storage_provider') || null,
    storagePublicId: get('storage_public_id') || null,
    storageFilename: get('storage_filename') || null,
    width: get('width') === null || get('width') === undefined ? null : Number(get('width')),
    height: get('height') === null || get('height') === undefined ? null : Number(get('height')),
    createdBy: get('created_by') ? String(get('created_by')) : null,
    createdAt: get('created_at') || null
  };
}

function settingsSelect() {
  return `
    SELECT
      bs.*,

      h.id AS header_id,
      h.name AS header_name,
      h.asset_type AS header_asset_type,
      h.url AS header_url,
      h.storage_provider AS header_storage_provider,
      h.storage_public_id AS header_storage_public_id,
      h.storage_filename AS header_storage_filename,
      h.width AS header_width,
      h.height AS header_height,
      h.created_by AS header_created_by,
      h.created_at AS header_created_at,

      c.id AS compact_id,
      c.name AS compact_name,
      c.asset_type AS compact_asset_type,
      c.url AS compact_url,
      c.storage_provider AS compact_storage_provider,
      c.storage_public_id AS compact_storage_public_id,
      c.storage_filename AS compact_storage_filename,
      c.width AS compact_width,
      c.height AS compact_height,
      c.created_by AS compact_created_by,
      c.created_at AS compact_created_at,

      f.id AS footer_id,
      f.name AS footer_name,
      f.asset_type AS footer_asset_type,
      f.url AS footer_url,
      f.storage_provider AS footer_storage_provider,
      f.storage_public_id AS footer_storage_public_id,
      f.storage_filename AS footer_storage_filename,
      f.width AS footer_width,
      f.height AS footer_height,
      f.created_by AS footer_created_by,
      f.created_at AS footer_created_at,

      i.id AS favicon_id,
      i.name AS favicon_name,
      i.asset_type AS favicon_asset_type,
      i.url AS favicon_url,
      i.storage_provider AS favicon_storage_provider,
      i.storage_public_id AS favicon_storage_public_id,
      i.storage_filename AS favicon_storage_filename,
      i.width AS favicon_width,
      i.height AS favicon_height,
      i.created_by AS favicon_created_by,
      i.created_at AS favicon_created_at

    FROM brand_settings bs
    LEFT JOIN brand_assets h ON h.id = bs.header_logo_asset_id
    LEFT JOIN brand_assets c ON c.id = bs.compact_logo_asset_id
    LEFT JOIN brand_assets f ON f.id = bs.footer_logo_asset_id
    LEFT JOIN brand_assets i ON i.id = bs.favicon_asset_id
    WHERE bs.id = 1
  `;
}

function mapSettings(row) {
  const headerLogo = mapAsset(row, 'header_');
  const compactLogo = mapAsset(row, 'compact_');
  const footerLogo = mapAsset(row, 'footer_');
  const favicon = mapAsset(row, 'favicon_');

  return {
    headerLogo,
    compactLogo,
    footerLogo,
    favicon,
    headerLogoUrl: headerLogo?.url || '/logo.svg?v=20260929-2',
    compactLogoUrl: compactLogo?.url || '/pwa-icon.svg',
    footerLogoUrl: footerLogo?.url || '/logo.svg?v=20260929-2',
    faviconUrl: favicon?.url || '/pwa-icon.svg',
    headerLogoDesktopWidth: Number(row?.header_logo_desktop_width || DEFAULTS.headerLogoDesktopWidth),
    headerLogoMobileWidth: Number(row?.header_logo_mobile_width || DEFAULTS.headerLogoMobileWidth),
    headerLogoCompactWidth: Number(row?.header_logo_compact_width || DEFAULTS.headerLogoCompactWidth),
    footerLogoDesktopWidth: Number(row?.footer_logo_desktop_width || DEFAULTS.footerLogoDesktopWidth),
    footerLogoMobileWidth: Number(row?.footer_logo_mobile_width || DEFAULTS.footerLogoMobileWidth),
    updatedAt: row?.updated_at || null
  };
}

async function ensureSettings() {
  await pool.query(
    `INSERT INTO brand_settings (id)
     VALUES (1)
     ON CONFLICT (id) DO NOTHING`
  );
}

export async function getBrandSettings() {
  await ensureSettings();
  const { rows } = await pool.query(settingsSelect());
  return mapSettings(rows[0] || {});
}

export async function listBrandAssets() {
  const { rows } = await pool.query(
    `SELECT *
     FROM brand_assets
     ORDER BY
       CASE asset_type WHEN 'LOGO' THEN 0 ELSE 1 END,
       created_at DESC,
       id DESC`
  );

  return rows.map((row) => mapAsset(row));
}

export async function getBrandAsset(id) {
  const { rows } = await pool.query(
    'SELECT * FROM brand_assets WHERE id = $1',
    [id]
  );
  return mapAsset(rows[0]);
}

export async function createBrandAsset({
  name,
  assetType,
  asset,
  createdBy
}) {
  const { rows } = await pool.query(
    `INSERT INTO brand_assets (
       name, asset_type, url,
       storage_provider, storage_public_id, storage_filename,
       width, height, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      name,
      assetType,
      asset.url,
      asset.provider || null,
      asset.publicId || null,
      asset.filename || null,
      asset.width || null,
      asset.height || null,
      createdBy || null
    ]
  );

  return mapAsset(rows[0]);
}

async function validateAssetType(id, expectedType, label) {
  if (id === null || id === undefined || id === '') return null;

  const asset = await getBrandAsset(id);
  if (!asset) throw new AppError(label + ' không tồn tại.', 404);
  if (asset.assetType !== expectedType) {
    throw new AppError(label + ' phải là asset loại ' + expectedType + '.', 400);
  }

  return Number(id);
}

export async function updateBrandSettings(values = {}, updatedBy) {
  await ensureSettings();

  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(values, 'headerLogoAssetId')) {
    normalized.headerLogoAssetId = await validateAssetType(
      values.headerLogoAssetId,
      'LOGO',
      'Logo header'
    );
  }

  if (Object.prototype.hasOwnProperty.call(values, 'compactLogoAssetId')) {
    normalized.compactLogoAssetId = await validateAssetType(
      values.compactLogoAssetId,
      'LOGO',
      'Logo header thu gọn'
    );
  }

  if (Object.prototype.hasOwnProperty.call(values, 'footerLogoAssetId')) {
    normalized.footerLogoAssetId = await validateAssetType(
      values.footerLogoAssetId,
      'LOGO',
      'Logo footer'
    );
  }

  if (Object.prototype.hasOwnProperty.call(values, 'faviconAssetId')) {
    normalized.faviconAssetId = await validateAssetType(
      values.faviconAssetId,
      'FAVICON',
      'Favicon'
    );
  }

  const columnMap = {
    headerLogoAssetId: 'header_logo_asset_id',
    compactLogoAssetId: 'compact_logo_asset_id',
    footerLogoAssetId: 'footer_logo_asset_id',
    faviconAssetId: 'favicon_asset_id',
    headerLogoDesktopWidth: 'header_logo_desktop_width',
    headerLogoMobileWidth: 'header_logo_mobile_width',
    headerLogoCompactWidth: 'header_logo_compact_width',
    footerLogoDesktopWidth: 'footer_logo_desktop_width',
    footerLogoMobileWidth: 'footer_logo_mobile_width'
  };

  const params = [];
  const sets = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const value = Object.prototype.hasOwnProperty.call(normalized, key)
      ? normalized[key]
      : values[key];
    params.push(value);
    sets.push(column + ' = $' + params.length);
  }

  if (sets.length) {
    params.push(updatedBy || null);
    sets.push('updated_by = $' + params.length);
    sets.push('updated_at = NOW()');

    await pool.query(
      'UPDATE brand_settings SET ' + sets.join(', ') + ' WHERE id = 1',
      params
    );
  }

  return getBrandSettings();
}

export async function getBrandAssetUsage(id) {
  const { rows } = await pool.query(
    `SELECT
       header_logo_asset_id = $1 AS header,
       compact_logo_asset_id = $1 AS compact,
       footer_logo_asset_id = $1 AS footer,
       favicon_asset_id = $1 AS favicon
     FROM brand_settings
     WHERE id = 1`,
    [id]
  );

  const row = rows[0] || {};
  return {
    header: Boolean(row.header),
    compact: Boolean(row.compact),
    footer: Boolean(row.footer),
    favicon: Boolean(row.favicon)
  };
}

export async function deleteBrandAsset(id) {
  const usage = await getBrandAssetUsage(id);
  const usedAt = Object.entries(usage)
    .filter(([, used]) => used)
    .map(([key]) => key);

  if (usedAt.length) {
    throw new AppError(
      'Asset đang được sử dụng. Hãy chọn asset khác trước khi xóa.',
      409
    );
  }

  const { rows } = await pool.query(
    'DELETE FROM brand_assets WHERE id = $1 RETURNING *',
    [id]
  );

  return mapAsset(rows[0]);
}
