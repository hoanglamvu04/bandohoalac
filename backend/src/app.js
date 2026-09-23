import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { uploadRoot } from './middleware/upload.js';
import { generalApiRateLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { resolveCorsOrigin } from './config/cors.js';

import authRoutes from './routes/auth.routes.js';
import placesRoutes from './routes/places.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import contributionsRoutes from './routes/contributions.routes.js';
import adminRoutes from './routes/admin.routes.js';
import usersRoutes from './routes/users.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import directionsRoutes from './routes/directions.routes.js';
import mapLayersRoutes from './routes/mapLayers.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: resolveCorsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }
  app.use('/uploads', express.static(uploadRoot));
  app.use('/api', generalApiRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'hola-maps-api', env: env.nodeEnv });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/places', placesRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/contributions', contributionsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/directions', directionsRoutes);
  app.use('/api/map-layers', mapLayersRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
