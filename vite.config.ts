/**
 * Vite config: React + Tailwind v4 static browser app served from the site
 * root (`base: '/'`), which client-side routes such as `/spike/amplify`
 * require: a relative base would resolve assets against the route path on
 * deep links. A production build fails if it contains the development
 * timing instrumentation or the Query Devtools
 * (`vite/noDevInstrumentation.ts`). `vite preview` serves the committed
 * Amplify headers and SPA rewrite, and a build fails if the rewrite would
 * hide one of its files (`vite/hostingPlugin.ts`). Vendor code is split
 * into cacheable chunks, `src/zodJitless.ts` in zod's (`vite/chunks.ts`).
 * The app's version (`package.json`) is defined as `__APP_VERSION__` (the
 * persisted cache's buster). Vitest extends this config (see
 * `vitest.config.ts`).
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { manualChunks } from './vite/chunks.ts';
import { hosting } from './vite/hostingPlugin.ts';
import { noDevInstrumentation } from './vite/noDevInstrumentation.ts';

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
  plugins: [react(), tailwindcss(), noDevInstrumentation(), hosting()],
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
