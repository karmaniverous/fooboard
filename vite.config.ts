/**
 * Vite config: React + Tailwind v4 static browser app served from the site
 * root (`base: '/'`), which client-side routes such as `/spike/amplify`
 * require: a relative base would resolve assets against the route path on
 * deep links. Vitest extends this config (see `vitest.config.ts`).
 *
 * @module
 */
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Split heavy, rarely-changing vendor code into its own cacheable chunks. */
function manualChunks(id: string): string | undefined {
  if (/node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) {
    return 'react-vendor';
  }
  if (/node_modules[\\/]@aws-sdk[\\/]/.test(id)) return 'aws-amplify';
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks } },
  },
});
