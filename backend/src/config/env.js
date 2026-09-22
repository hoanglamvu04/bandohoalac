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
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadFileSizeMb: Number(process.env.MAX_UPLOAD_FILE_SIZE_MB) || 5,
  maxUploadFileCount: Number(process.env.MAX_UPLOAD_FILE_COUNT) || 8,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5000}`,
  routingBaseUrl: process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org',
  routingTimeoutMs: Number(process.env.ROUTING_TIMEOUT_MS) || 10000
};
