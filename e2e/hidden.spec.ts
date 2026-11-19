/**
 * Polling while the tab is hidden (spec §3.L, Decision 113), in the demo:
 * hidden by overriding `document.visibilityState` and announcing the
 * change, as a browser does when the tab goes to the background, the
 * board keeps reading (the GitHub token's battery keeps going down), and
 * showing the tab again carries on at the usual rate.
 *
 * @module
 */
import type { Page } from '@playwright/test';

import { MIN_TEST_TIMEOUT_MS } from '../src/test/timeouts';
import { openDemo } from './board';
import { expect, test } from './guard';

/** How long the tab stays hidden: in-progress rows poll from 5 s, so
 * several hidden polls land within it. */
const HIDDEN_MS = 15_000;

/** Time for the reads in flight when the tab hides (the opening's jobs
 * and compares) to land, so only polls count after it. */
const SETTLE_MS = 6_000;

/** Requests left on the demo's GitHub token, from its battery. */
async function requestsLeft(page: Page): Promise<number> {
  const name = await page
    .getByRole('meter', { name: /requests left/ })
    .first()
    .getAttribute('aria-label');
  const left = /([\d,]+) of [\d,]+ requests left/.exec(name ?? '')?.[1];
  if (left === undefined)
    throw new Error(`no battery reading in ${name ?? 'nothing'}`);
  return Number(left.replaceAll(',', ''));
}

/** Tell the page its tab is `state`, as the browser would. */
async function setVisibility(
  page: Page,
  state: 'hidden' | 'visible',
): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => next,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => next === 'hidden',
    });
    // Bubbling, so listeners on `window` (TanStack's) hear it too.
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }, state);
}

test('the demo keeps reading while the tab is hidden', async ({ page }) => {
  test.setTimeout(2 * MIN_TEST_TIMEOUT_MS);
  await openDemo(page);
  await setVisibility(page, 'hidden');
  expect(await page.evaluate(() => document.hidden)).toBe(true);
  await page.waitForTimeout(SETTLE_MS);
  const before = await requestsLeft(page);
  await page.waitForTimeout(HIDDEN_MS);
  expect(await requestsLeft(page)).toBeLessThan(before);
  await setVisibility(page, 'visible');
  const shown = await requestsLeft(page);
  await expect
    .poll(() => requestsLeft(page), { timeout: MIN_TEST_TIMEOUT_MS })
    .toBeLessThan(shown);
});
