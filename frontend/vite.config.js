import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // MapLibre ships its own web worker. Vite's dependency optimizer can
  // occasionally cache a generated maplibre-gl-worker.mjs path that no
  // longer exists, which forces a slow recovery/reload in dev. Let
  // MapLibre be served normally instead of pre-bundling it.
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },

  server: {
    port: 5175,
    // If 5175 is already taken, Vite tries the next available port.
    strictPort: false,
    host: true
  },

  preview: {
    port: 4173,
    strictPort: false,
    host: true
  }
});
