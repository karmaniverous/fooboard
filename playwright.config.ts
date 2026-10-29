/**
 * Playwright config (spec.md §3.10, Decision 40): the smoke tests in
 * `e2e/` run against `vite preview` serving the production build with the
 * headers of `customHttp.yml` and the SPA rewrite (`vite/hostingPlugin.ts`),
 * so they run under the CSP that ships. Build first (`npm run build`).
 *
 * CI runs Chromium. The browser pass runs the same tests in every engine
 * installed here: `FOOBOARD_E2E_BROWSERS=all` adds Chrome and Edge (the
 * installed channels), Firefox and WebKit (Safari's engine).
 *
 * @module
 */
import { defineConfig, devices, type Project } from '@playwright/test';

import { MIN_TEST_TIMEOUT_MS } from './src/test/timeouts';

/** `vite preview`'s port for the tests. */
const PORT = 4173;
const CI = Boolean(process.env.CI);

/** The npm script release-it's `after:init` hook runs the e2e suite with
 * (Decision 99). npm sets `npm_lifecycle_event` to the running script's
 * name; under this one the config never reuses a server already on the
 * port, so a release tests the build it has just made (a taken port then
 * fails the run at once). */
export const RELEASE_E2E_SCRIPT = 'e2e:release';

/** The board's design viewport (`DEMO_VIEWPORT`: a maximised browser on a
 * 1080p screen), where the demo needs no scrolling. */
const VIEWPORT = { width: 1920, height: 950 };

const desktop = (name: string, device: string, channel?: string): Project => ({
  name,
  use: {
    ...devices[device],
    viewport: VIEWPORT,
    ...(channel ? { channel } : {}),
  },
});

const ENGINES: Project[] = [
  desktop('chrome', 'Desktop Chrome', 'chrome'),
  desktop('edge', 'Desktop Edge', 'msedge'),
  desktop('firefox', 'Desktop Firefox'),
  desktop('webkit', 'Desktop Safari'),
];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Firefox and WebKit on a busy machine take seconds where Chromium takes
  // milliseconds (a Tab press can take half a second in Firefox).
  timeout: 60_000,
  // Likewise a closing panel's focus return (3.7 s seen in Firefox here);
  // no assertion times out sooner than the suite's floor.
  expect: { timeout: MIN_TEST_TIMEOUT_MS },
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects:
    process.env.FOOBOARD_E2E_BROWSERS === 'all'
      ? [desktop('chromium', 'Desktop Chrome'), ...ENGINES]
      : [desktop('chromium', 'Desktop Chrome')],
  webServer: {
    command: `npx vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    // Outside CI, a server already running is reused, except by a release.
    reuseExistingServer:
      !CI && process.env.npm_lifecycle_event !== RELEASE_E2E_SCRIPT,
  },
});
