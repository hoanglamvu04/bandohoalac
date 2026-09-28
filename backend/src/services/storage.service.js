import { createHash, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function sanitizeFolder(value) {
  return String(value || '')
    .split('/')
    .map((part) => part.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function cloudinaryConfig() {
  if (!env.cloudinaryUrl) {
    throw new AppError('CLOUDINARY_URL is required when UPLOAD_PROVIDER=cloudinary.', 500);
  }

  let url;
  try {
    url = new URL(env.cloudinaryUrl);
  } catch {
    throw new AppError('CLOUDINARY_URL is invalid.', 500);
  }

  if (url.protocol !== 'cloudinary:') {
    throw new AppError('CLOUDINARY_URL must start with cloudinary://', 500);
  }

  const cloudName = url.hostname;
  const apiKey = decodeURIComponent(url.username || '');
  const apiSecret = decodeURIComponent(url.password || '');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError('CLOUDINARY_URL must include cloud name, API key and API secret.', 500);
  }

  return { cloudName, apiKey, apiSecret };
}

function signCloudinaryParams(params, apiSecret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
    .join('&');

  return createHash('sha1')
    .update(serialized + apiSecret)
    .digest('hex');
}

function assetFolder(scope) {
  return sanitizeFolder([
    env.cloudinaryFolder || 'hola-maps',
    scope || 'misc'
  ].join('/'));
}

async function uploadCloudinaryFile(file, {
  scope = 'misc',
  prefix = 'image'
} = {}) {
  if (!file?.buffer) {
    throw new AppError('Cloudinary upload received an empty file buffer.', 500);
  }

  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = assetFolder(scope);
  const publicId = sanitizeFolder(prefix).replaceAll('/', '-') + '-' + randomUUID();

  const signedParams = {
    asset_folder: folder,
    public_id: publicId,
    timestamp
  };

  const signature = signCloudinaryParams(signedParams, apiSecret);
  const body = new FormData();
  body.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'image');
  body.append('api_key', apiKey);
  body.append('timestamp', String(timestamp));
  body.append('signature', signature);
  body.append('asset_folder', folder);
  body.append('public_id', publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: 'POST', body }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    throw new AppError(
      payload?.error?.message || 'Cloudinary upload failed.',
      502
    );
  }

  return {
    provider: 'cloudinary',
    url: payload.secure_url,
    publicId: payload.public_id,
    assetFolder: payload.asset_folder || folder,
    width: payload.width,
    height: payload.height,
    format: payload.format,
    bytes: payload.bytes
  };
}

function localFileAsset(file) {
  return {
    provider: 'local',
    url: `${env.publicBaseUrl}/uploads/${file.filename}`,
    filename: file.filename
  };
}

export async function storeUploadedFiles(files = [], options = {}) {
  if (!files.length) return [];

  if (env.uploadProvider === 'cloudinary') {
    const uploaded = [];

    try {
      for (const file of files) {
        uploaded.push(await uploadCloudinaryFile(file, options));
      }
      return uploaded;
    } catch (error) {
      await deleteStoredAssets(uploaded).catch(() => {});
      throw error;
    }
  }

  return files.map(localFileAsset);
}

async function destroyCloudinaryAsset(asset) {
  if (!asset?.publicId) return;

  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    invalidate: true,
    public_id: asset.publicId,
    timestamp
  };
  const signature = signCloudinaryParams(params, apiSecret);

  const body = new URLSearchParams({
    public_id: asset.publicId,
    invalidate: 'true',
    timestamp: String(timestamp),
    api_key: apiKey,
    signature
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Cloudinary delete failed.');
  }
}

async function deleteLocalAsset(asset) {
  if (!asset?.filename) return;
  const fullPath = path.resolve(process.cwd(), env.uploadDir, asset.filename);
  await unlink(fullPath).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
}

export async function deleteStoredAssets(assets = []) {
  for (const asset of assets) {
    if (!asset) continue;

    try {
      if (asset.provider === 'cloudinary') {
        await destroyCloudinaryAsset(asset);
      } else if (asset.provider === 'local') {
        await deleteLocalAsset(asset);
      }
    } catch (error) {
      console.warn('[Hola Maps] Failed to delete stored asset:', error.message);
    }
  }
}
