import { env } from '../config/env.js';

/**
 * Storage abstraction. Today files land on local disk (via multer diskStorage,
 * see middleware/upload.js) and this service only turns a stored filename into
 * a public URL. Swapping to Cloudflare R2 (or any object store) later only
 * means changing this module + the multer storage engine — nothing in the
 * controllers/services that call getPublicUrl() has to change.
 */
export function getPublicUrl(filename) {
  return `${env.publicBaseUrl}/uploads/${filename}`;
}

export function getPublicUrls(filenames = []) {
  return filenames.map(getPublicUrl);
}
