/**
 * Vitest config: jsdom environment (components and pure functions share one
 * test run), Testing Library matchers loaded globally, V8 coverage reported
 * on every run.
 *
 * Coverage is reported, not gated. Aim for adequate coverage of meaningful
 * behaviour (decision branches, edge cases, error paths), not a percentage.
 *
 * @module
 */
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
