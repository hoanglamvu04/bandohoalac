import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
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

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, uploadRoot);
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${ext}`);
  }
});

function fileFilter(_req, file, callback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return callback(new AppError('Only JPG, PNG or WEBP images are allowed.', 400));
  }
  return callback(null, true);
}

export const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadFileSizeMb * 1024 * 1024,
    files: env.maxUploadFileCount
  }
}).array('photos', env.maxUploadFileCount);

export { uploadRoot };
