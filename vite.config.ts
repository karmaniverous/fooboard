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

/** Heavy, rarely-changing vendor code, each group its own cacheable chunk:
 * React, the AWS SDK, the UI kit (Radix, icons) and the data libraries
 * (schemas, JSONPath, utilities). */
const VENDOR_CHUNKS: readonly [RegExp, string][] = [
  [
    /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
    'react-vendor',
  ],
  [/node_modules[\\/]@aws-sdk[\\/]/, 'aws-amplify'],
  [/node_modules[\\/](@radix-ui|lucide-react)[\\/]/, 'ui-vendor'],
  [/node_modules[\\/](zod|json-p3|radash)[\\/]/, 'data-vendor'],
];

/** Split vendor code into {@link VENDOR_CHUNKS}. */
function manualChunks(id: string): string | undefined {
  return VENDOR_CHUNKS.find(([pattern]) => pattern.test(id))?.[1];
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
