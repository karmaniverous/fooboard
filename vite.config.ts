/**
 * Vite config: React + Tailwind v4 static browser app served from the site
 * root (`base: '/'`), which client-side routes such as `/spike/amplify`
 * require: a relative base would resolve assets against the route path on
 * deep links. A production build fails if it contains the development
 * timing instrumentation or the Query Devtools
 * (`vite/noDevInstrumentation.ts`). The app's version (`package.json`)
 * is defined as `__APP_VERSION__` (the persisted cache's buster). Vitest
 * extends this config (see `vitest.config.ts`).
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { noDevInstrumentation } from './vite/noDevInstrumentation.ts';

/** Heavy, rarely-changing vendor code, each group its own cacheable chunk:
 * React, the AWS SDK, the UI kit (Radix, dnd-kit, icons) and the data libraries
 * (schemas, JSONPath, utilities). */
const VENDOR_CHUNKS: readonly [RegExp, string][] = [
  [
    /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
    'react-vendor',
  ],
  [/node_modules[\\/]@aws-sdk[\\/]/, 'aws-amplify'],
  [/node_modules[\\/](@radix-ui|@dnd-kit|lucide-react)[\\/]/, 'ui-vendor'],
  [/node_modules[\\/](zod|json-p3|radash)[\\/]/, 'data-vendor'],
];

/** Split vendor code into {@link VENDOR_CHUNKS}. */
function manualChunks(id: string): string | undefined {
  return VENDOR_CHUNKS.find(([pattern]) => pattern.test(id))?.[1];
}

/** The app's version, from `package.json`. */
const version = ((): string => {
  const pkg: unknown = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'),
  );
  if (
    typeof pkg !== 'object' ||
    pkg === null ||
    !('version' in pkg) ||
    typeof pkg.version !== 'string'
  )
    throw new Error('package.json has no version');
  return pkg.version;
})();

export default defineConfig({
  plugins: [react(), tailwindcss(), noDevInstrumentation()],
  define: { __APP_VERSION__: JSON.stringify(version) },
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
