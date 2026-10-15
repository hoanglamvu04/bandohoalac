import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function pmtilesNoCachePlugin() {
  const applyHeaders = (req, res, next) => {
    const pathname = String(req.url || '').split('?')[0];
    if (pathname.endsWith('.pmtiles')) {
      // PMTiles uses HTTP Range requests. Chromium on Windows can keep a
      // poisoned partial response in its disk cache and report
      // ERR_CACHE_OPERATION_NOT_SUPPORTED even though PMTiles retries.
      // Prevent the dev/preview server from making those range responses
      // cacheable in the first place.
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Accept-Ranges', 'bytes');
    }
    next();
  };

  return {
    name: 'hola-pmtiles-no-cache',
    configureServer(server) {
      server.middlewares.use(applyHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders);
    }
  };
}

export default defineConfig({
  plugins: [react(), pmtilesNoCachePlugin()],

  // MapLibre ships its own web worker. Vite's dependency optimizer can
  // occasionally cache a generated maplibre-gl-worker.mjs path that no
  // longer exists, which forces a slow recovery/reload in dev. Let
  // MapLibre be served normally instead of pre-bundling it.
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // Keep the expensive mapping runtime in separate long-lived chunks.
          // Map routes are lazy, so these files are not downloaded by normal
          // content/admin pages and individual libraries can be cached across
          // deployments instead of invalidating one 1MB+ map-vendor bundle.
          if (id.includes('maplibre-gl')) return 'maplibre-vendor';
          if (id.includes('/pmtiles/')) return 'pmtiles-vendor';
          if (id.includes('@protomaps')) return 'basemap-vendor';
          if (id.includes('react-router')) return 'router-vendor';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/axios/')) return 'http-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          return undefined;
        }
      }
    }
  },

  server: {
    port: 5175,
    strictPort: false,
    host: true
  },

  preview: {
    port: 4173,
    strictPort: false,
    host: true
  }
});
