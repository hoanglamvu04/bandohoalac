import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!existsSync(uploadRoot)) {
  mkdirSync(uploadRoot, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, uploadRoot);
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, randomUUID() + ext);
  }
});

const storage = env.uploadProvider === 'cloudinary'
  ? multer.memoryStorage()
  : localDiskStorage;

function fileFilter(_req, file, callback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return callback(new AppError('Only JPG, PNG or WEBP images are allowed.', 400));
  }
  return callback(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadFileSizeMb * 1024 * 1024,
    files: env.maxUploadFileCount
  }
});

function sniffPng(buffer) {
  const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null;
  return {
    mime: 'image/png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function sniffJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;

    if (sof.has(marker) && length >= 7) {
      return {
        mime: 'image/jpeg',
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function sniffWebp(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  const kind = buffer.toString('ascii', 12, 16);

  if (kind === 'VP8X') {
    return {
      mime: 'image/webp',
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (kind === 'VP8L' && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      mime: 'image/webp',
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff)
    };
  }

  if (
    kind === 'VP8 ' &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      mime: 'image/webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  return null;
}

function inspectImage(buffer) {
  return sniffPng(buffer) || sniffJpeg(buffer) || sniffWebp(buffer);
}

async function readUploadedBytes(file) {
  if (file?.buffer) return file.buffer;
  if (file?.path) return readFile(file.path);
  return Buffer.alloc(0);
}

async function removeTemporaryFile(file) {
  if (file?.path) await unlink(file.path).catch(() => {});
}

async function validateUploadedFile(file) {
  const bytes = await readUploadedBytes(file);
  const detected = inspectImage(bytes);

  if (!detected || detected.mime !== file.mimetype) {
    throw new AppError('Tệp tải lên không phải ảnh JPG, PNG hoặc WEBP hợp lệ.', 400);
  }

  const pixels = Number(detected.width) * Number(detected.height);
  const maxPixels = env.maxUploadMegapixels * 1_000_000;

  if (
    !Number.isFinite(pixels) ||
    detected.width < 1 ||
    detected.height < 1 ||
    detected.width > env.maxUploadDimension ||
    detected.height > env.maxUploadDimension ||
    pixels > maxPixels
  ) {
    throw new AppError(
      'Kích thước ảnh quá lớn. Hãy dùng ảnh nhỏ hơn ' + env.maxUploadMegapixels + ' megapixel.',
      400
    );
  }

  file.detectedMime = detected.mime;
  file.detectedWidth = detected.width;
  file.detectedHeight = detected.height;
}

async function validateRequestFiles(req, next) {
  const files = Array.isArray(req.files)
    ? req.files
    : (req.file ? [req.file] : []);

  try {
    for (const file of files) await validateUploadedFile(file);
    return next();
  } catch (error) {
    await Promise.all(files.map(removeTemporaryFile));
    req.files = [];
    req.file = undefined;
    return next(error);
  }
}

function arrayMiddleware() {
  const middleware = uploader.array('photos', env.maxUploadFileCount);
  return function secureImageArray(req, res, next) {
    middleware(req, res, (error) => {
      if (error) return next(error);
      validateRequestFiles(req, next);
    });
  };
}

function singleMiddleware() {
  const middleware = uploader.single('image');
  return function secureSingleImage(req, res, next) {
    middleware(req, res, (error) => {
      if (error) return next(error);
      validateRequestFiles(req, next);
    });
  };
}

export const uploadPhotos = arrayMiddleware();
export const uploadSingleImage = singleMiddleware();

export { uploadRoot };
