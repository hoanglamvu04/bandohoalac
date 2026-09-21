import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // If 5173 is already taken (e.g. a second `npm run dev`), Vite tries
    // 5174, 5175, ... instead of crashing.
    strictPort: false,
    host: true
  },
  preview: {
    port: 4173,
    strictPort: false,
    host: true
  }
});
