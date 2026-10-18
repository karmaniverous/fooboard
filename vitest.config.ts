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
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // Editor tests drive many renders in jsdom; under a full parallel run
      // the slowest come near the 5 s default.
      testTimeout: 15_000,
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      },
    },
  }),
);
