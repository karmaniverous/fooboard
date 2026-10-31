/**
 * Playwright config for `npm run screenshots` (CONTRIBUTING,
 * "Screenshots"): runs `take.shots.ts` in Chromium, one shot at a time,
 * against `vite preview` serving the production build with the headers
 * that ship. Its own port, never a server already running, so the shots
 * show the build the script has just made; Playwright stops the server
 * when the shots are done. Not part of `npm run e2e` or CI.
 *
 * @module
 */
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { MIN_TEST_TIMEOUT_MS } from '../../src/test/timeouts';

/** The repo's root, where `vite preview` runs. */
const ROOT = path.resolve(import.meta.dirname, '../..');

/** `vite preview`'s port for the shots (the e2e suite's is 4173). */
const PORT = 4174;

export default defineConfig({
  testDir: '.',
  testMatch: 'take.shots.ts',
  outputDir: path.join(ROOT, 'test-results', 'screenshots'),
  // One shot at a time: a busy machine settles views more slowly.
  workers: 1,
  timeout: 2 * MIN_TEST_TIMEOUT_MS,
  expect: { timeout: MIN_TEST_TIMEOUT_MS },
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${String(PORT)}`,
  },
  webServer: {
    command: `npx vite preview --port ${String(PORT)} --strictPort`,
    cwd: ROOT,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
  },
});
