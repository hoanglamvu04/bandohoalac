import { createApp } from './app.js';
import { env } from './config/env.js';
import { listenWithFallback } from './utils/listen.js';

const app = createApp();

listenWithFallback(app, env.port, {
  onFallback: (busyPort, nextPort) => {
    console.warn(`Port ${busyPort} is already in use, trying ${nextPort}...`);
  },
  onListening: (port) => {
    if (port !== env.port) {
      console.warn(`⚠ Configured PORT ${env.port} was busy. If your frontend's`);
      console.warn(`  VITE_API_URL still points at ${env.port}, update it to match.`);
    }
    console.log(`Hola Maps API listening on port ${port} (${env.nodeEnv})`);
    console.log(`Server running at: http://localhost:${port}`);
  }
});
