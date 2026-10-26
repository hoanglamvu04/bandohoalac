import { createApp } from './app.js';
import { env } from './config/env.js';
import { listenWithFallback } from './utils/listen.js';
import {
  startIngestionScheduler,
  stopIngestionScheduler
} from './services/ingestionScheduler.service.js';

const app = createApp();

listenWithFallback(app, env.port, {
  host: env.host,
  onFallback: (busyPort, nextPort) => {
    console.warn(`Port ${busyPort} is already in use, trying ${nextPort}...`);
  },
  onListening: (port, host) => {
    if (port !== env.port) {
      console.warn(`⚠ Configured PORT ${env.port} was busy. If your frontend's`);
      console.warn(`  VITE_API_URL still points at ${env.port}, update it to match.`);
    }
    console.log(`Hola Maps API listening on ${host || '0.0.0.0'}:${port} (${env.nodeEnv})`);
    console.log(`Server running at: http://${host || 'localhost'}:${port}`);
    startIngestionScheduler();
  }
});

process.once('SIGTERM', stopIngestionScheduler);
process.once('SIGINT', stopIngestionScheduler);
