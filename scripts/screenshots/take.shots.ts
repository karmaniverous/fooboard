/**
 * Takes the README's screenshots (`npm run screenshots`; CONTRIBUTING,
 * "Screenshots"): every shot in `shots.ts`, light and dark, from
 * `vite preview` serving the production build, into `docs/screenshots/`.
 * Not a test: only `./playwright.config.ts` runs it, never `npm run e2e`.
 *
 * Reruns are stable: each shot opens a fresh browser context (no saved
 * dashboards, so `/` is the home page), the demo plays its fixed seed
 * (Q31), and the page's clock is pinned, so the simulated world and every
 * "time ago" are the same on every run. Animations are stopped for the
 * capture (a spinner draws at its first frame). Every view is reached
 * from a fresh visit with no other setup.
 *
 * @module
 */
import path from 'node:path';

import type { Page } from '@playwright/test';

import { openDemo } from '../../e2e/board';
import { expect, test } from '../../e2e/guard';
import { MIN_TEST_TIMEOUT_MS } from '../../src/test/timeouts';
import { SCHEMES, type ShotName, SHOTS } from './shots';

/** Where the README's screenshots live. */
const OUT = path.resolve(import.meta.dirname, '../../docs/screenshots');

/** The page's pinned time: the date in the demo's seed (`DEMO_SEED`). */
const SHOT_TIME = new Date('2026-10-25T12:00:00Z');

/** How long a view settles after it opens (panels slide, layout holds
 * still): a pause, not a timeout. */
const SETTLE_MS = 2_000;

/** The demo with every cell filled in: none still loading (`aria-busy`),
 * and the search row (the scenario's failing repo) showing its error,
 * which it does only once its retries have failed, seconds later. */
async function demo(page: Page): Promise<void> {
  await openDemo(page);
  const grid = page.getByRole('grid');
  await expect(grid.locator('[aria-busy]')).toHaveCount(0, {
    timeout: MIN_TEST_TIMEOUT_MS,
  });
  await expect(
    grid.getByRole('button', {
      name: /^1 problem: Couldn't read acme\/search/,
    }),
  ).toBeVisible({ timeout: MIN_TEST_TIMEOUT_MS });
}

/** The demo with its storefront row's settings popup open. */
async function rowPopup(page: Page): Promise<void> {
  await demo(page);
  await page
    .getByRole('button', { name: 'Settings for row storefront', exact: true })
    .first()
    .click();
}

/** Each shot's view, opened on a fresh page. */
const VIEWS: Record<ShotName, (page: Page) => Promise<void>> = {
  demo,
  home: async (page) => {
    await page.goto('/');
    await page.getByRole('main').waitFor();
  },
  board: demo,
  editor: async (page) => {
    await demo(page);
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
  },
  'settings-editor': async (page) => {
    await rowPopup(page);
    await page
      .getByRole('button', { name: 'Open in dashboard settings' })
      .click();
  },
  'row-popup': rowPopup,
  credentials: async (page) => {
    await demo(page);
    await page.getByRole('button', { name: 'Credentials' }).click();
  },
};

for (const scheme of SCHEMES)
  for (const shot of SHOTS)
    test.describe(() => {
      test.use({
        viewport: shot.viewport,
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });

      test(`${shot.name}-${scheme}`, async ({ page }) => {
        await page.clock.setFixedTime(SHOT_TIME);
        await VIEWS[shot.name](page);
        await page.waitForTimeout(SETTLE_MS);
        await page.screenshot({
          path: path.join(OUT, `${shot.name}-${scheme}.png`),
          animations: 'disabled',
          ...('clip' in shot ? { clip: { x: 0, y: 0, ...shot.clip } } : {}),
        });
      });
    });
