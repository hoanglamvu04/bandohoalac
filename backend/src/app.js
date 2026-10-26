import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { uploadRoot } from './middleware/upload.js';
import {
  generalApiRateLimiter,
  haloIntegrationRateLimiter,
  mapReadRateLimiter,
  publicIntegrationRateLimiter
} from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { developerApiGateway } from './middleware/developerApi.js';
import { resolveCorsOrigin, resolvePublicApiCorsOrigin } from './config/cors.js';

import authRoutes from './routes/auth.routes.js';
import placesRoutes from './routes/places.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import contributionsRoutes from './routes/contributions.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adminCoverageRoutes from './routes/adminCoverage.routes.js';
import adminHaloSyncRoutes from './routes/adminHaloSync.routes.js';
import usersRoutes from './routes/users.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import directionsRoutes from './routes/directions.routes.js';
import mapLayersRoutes from './routes/mapLayers.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import advertisementsRoutes from './routes/advertisements.routes.js';
import rewardsRoutes from './routes/rewards.routes.js';
import missionsRoutes from './routes/missions.routes.js';
import placeClaimsRoutes from './routes/placeClaims.routes.js';
import partnerPortalRoutes from './routes/partnerPortal.routes.js';
import brandRoutes from './routes/brand.routes.js';
import publicIntegrationRoutes from './routes/publicIntegration.routes.js';
import haloHolaRoutes from './routes/haloHola.routes.js';
import exploreRoutes from './routes/explore.routes.js';
import housingRoutes from './routes/housing.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()'
    );
    next();
  });

  const appCors = cors({ origin: resolveCorsOrigin, credentials: true });
  const publicApiCors = cors({
    origin: resolvePublicApiCorsOrigin,
    exposedHeaders: ['X-Hola-API-Version', 'X-Hola-Cache', 'X-Hola-Client', 'X-Hola-RateLimit-Limit', 'X-Hola-RateLimit-Remaining', 'X-Hola-RateLimit-Reset', 'RateLimit', 'RateLimit-Policy']
  });

  app.use((req, res, next) => {
    if (String(req.path || '').startsWith('/api/public/v1')) {
      return publicApiCors(req, res, next);
    }
    return appCors(req, res, next);
  });
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }
  app.use('/uploads', express.static(uploadRoot, {
    maxAge: '365d',
    immutable: true,
    etag: true
  }));
  app.use('/api', generalApiRateLimiter);
  app.use('/api/public/v1', publicIntegrationRateLimiter);
  app.use('/api/public/v1', developerApiGateway);
  app.use('/api/places/bounds', mapReadRateLimiter);
  app.use('/api/map-layers', mapReadRateLimiter);
  app.use('/api/halo/v1/spots', mapReadRateLimiter);
  app.use('/api/halo/v1/places', mapReadRateLimiter);
  app.use('/api/halo/v1/posts', haloIntegrationRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'hola-maps-api' });
  });

  app.get('/api/sitemap-places.xml', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, updated_at
        FROM places
        WHERE status = 'PUBLISHED'
        ORDER BY updated_at DESC
        LIMIT 10000
      `);

      const urls = rows.map((place) => {
        const lastmod = place.updated_at
          ? `\n    <lastmod>${new Date(place.updated_at).toISOString()}</lastmod>`
          : '';
        return `  <url>\n    <loc>https://maps.dothihoalac.vn/place/${place.id}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      }).join('\n');

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sitemap-explore.xml', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT slug, updated_at
        FROM explore_articles
        WHERE status = 'PUBLISHED'
          AND published_at <= NOW()
        ORDER BY published_at DESC, id DESC
        LIMIT 5000
      `);

      const urls = [
        {
          slug: '',
          updated_at: rows[0]?.updated_at || new Date()
        },
        ...rows
      ].map((article) => {
        const path = article.slug
          ? '/kham-pha/' + encodeURIComponent(article.slug)
          : '/kham-pha';
        const lastmod = article.updated_at
          ? `\n    <lastmod>${new Date(article.updated_at).toISOString()}</lastmod>`
          : '';
        return `  <url>\n    <loc>https://maps.dothihoalac.vn${path}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>${article.slug ? '0.8' : '0.9'}</priority>\n  </url>`;
      }).join('\n');

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/explore', exploreRoutes);
  app.use('/api/housing', housingRoutes);

  app.use('/api/public/v1', publicIntegrationRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/places', placesRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/contributions', contributionsRoutes);
  app.use('/api/admin/coverage-cleanup', adminCoverageRoutes);
  app.use('/api/admin/halo-sync', adminHaloSyncRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/directions', directionsRoutes);
  app.use('/api/map-layers', mapLayersRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/ads', advertisementsRoutes);
  app.use('/api/rewards', rewardsRoutes);
  app.use('/api/missions', missionsRoutes);
  app.use('/api/place-claims', placeClaimsRoutes);
  app.use('/api/partner', partnerPortalRoutes);
  app.use('/api/brand', brandRoutes);
  app.use('/api/halo/v1', haloHolaRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
