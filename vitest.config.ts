/**
 * Vitest config: extends the Vite config (same plugins and `@` alias, so
 * they are defined once), jsdom environment, Testing Library matchers
 * loaded globally, V8 coverage reported on every run.
 *
 * Coverage is reported, not gated. Aim for adequate coverage of meaningful
 * behaviour (decision branches, edge cases, error paths), not a percentage.
 *
 * @module
 */
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import { MIN_TEST_TIMEOUT_MS } from './src/test/timeouts.ts';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // The Playwright smoke tests (e2e/) run in browsers, not here.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      // No test or hook times out sooner than this (src/test/timeouts.ts):
      // a slow or busy machine runs the suite several times slower than CI.
      testTimeout: MIN_TEST_TIMEOUT_MS,
      hookTimeout: MIN_TEST_TIMEOUT_MS,
      setupFiles: ['./src/test/setup.ts'],
      // CSS is stubbed in tests, except the theme, whose tokens
      // theme.test.ts reads (as raw text) to check their contrast.
      css: { include: [/src\/index\.css/] },
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}', 'vite/**/*.ts'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'vite/**/*.test.ts',
          'src/main.tsx',
        ],
      },
    },
  }),
);
