import dotenv from 'dotenv';

dotenv.config();

function requireInProduction(name, value, fallback) {
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hola_maps',
  jwtSecret: requireInProduction('JWT_SECRET', process.env.JWT_SECRET, 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES || process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim()),
  publicApiCorsOrigin: (process.env.PUBLIC_API_CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadProvider: (process.env.UPLOAD_PROVIDER || 'local').trim().toLowerCase(),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  cloudinaryUrl: (process.env.CLOUDINARY_URL || '').trim(),
  cloudinaryFolder: (process.env.CLOUDINARY_FOLDER || 'hola-maps').trim(),
  maxUploadFileSizeMb: Number(process.env.MAX_UPLOAD_FILE_SIZE_MB) || 5,
  maxUploadFileCount: Math.max(Number(process.env.MAX_UPLOAD_FILE_COUNT) || 20, 20),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5000}`,
  holaMapsWebUrl: (process.env.HOLA_MAPS_WEB_URL || '').trim(),
  routingBaseUrl: process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org',
  routingTimeoutMs: Number(process.env.ROUTING_TIMEOUT_MS) || 10000,
  overtureCliPath: (process.env.OVERTURE_CLI_PATH || '').trim(),
  foursquareApiKey: (process.env.FOURSQUARE_API_KEY || '').trim(),
  haloHolaSharedSecret: (process.env.HALO_HOLA_SHARED_SECRET || '').trim(),
  photoScanRequestTimeoutMs: Math.max(Number(process.env.PHOTO_SCAN_REQUEST_TIMEOUT_MS) || 9000, 2000),
  photoScanWikimediaRadiusM: Math.min(Math.max(Number(process.env.PHOTO_SCAN_WIKIMEDIA_RADIUS_M) || 350, 50), 1000),
  photoScanCandidatesPerProvider: Math.min(Math.max(Number(process.env.PHOTO_SCAN_CANDIDATES_PER_PROVIDER) || 8, 1), 20),
  photoScanMaxCandidatesPerPlace: Math.min(Math.max(Number(process.env.PHOTO_SCAN_MAX_CANDIDATES_PER_PLACE) || 8, 1), 20),
  placeBoundsCacheTtlMs: Math.max(Number(process.env.PLACE_BOUNDS_CACHE_TTL_MS) || 30000, 1000),
  placeBoundsCacheMaxEntries: Math.max(Number(process.env.PLACE_BOUNDS_CACHE_MAX_ENTRIES) || 400, 20)
};
