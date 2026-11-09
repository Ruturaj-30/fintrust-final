// Vite builds the React app (client/) into ../public, which Express serves.
//   npm run build  -> production files in public/
//   npm run dev    -> live-reload UI on http://localhost:5173 (run "npm start" in another terminal)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(here, 'src') } },
  build: {
    outDir: path.resolve(here, '../public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
});
