/**
 * Touch scrolling the demo on a phone (spec.md C-13; Decision 76; #47):
 * the board leaves a one-finger scroll to the browser, and neither a
 * scroll nor the window's height changing under it (iOS's address bar)
 * changes the board's size or zoom.
 *
 * Emulation can't show a real address bar: Chromium's touch scroll here is
 * a real one (CDP touch events); mobile WebKit has neither touch moves nor
 * the wheel in Playwright, so it scrolls the window directly; and the
 * address bar is stood in for by a viewport that only gets shorter or
 * taller. Firefox has no mobile emulation.
 *
 * On a portrait phone the demo sits at rung 0 at its least height, taller
 * than the window, so a height change alone didn't re-lay it out even
 * before #47; the resize check guards the rule (the unit tests in
 * `useAreaSize.test.tsx` prove it), while the touch-action and
 * `scrollBy` checks fail on the code before it.
 *
 * @module
 */
import type { Locator, Page } from '@playwright/test';

import { openDemo } from './board';
import { expect, test } from './guard';

/** An iPhone's viewport with its toolbars collapsed (CSS px). */
const PHONE = { width: 390, height: 844 };
/** About what iOS's address bar takes when it expands again (CSS px). */
const ADDRESS_BAR_PX = 80;
/** Zoom steps in, so the board is taller than the phone. */
const ZOOM_STEPS = 3;
/** How far each scroll goes (CSS px). */
const SCROLL_PX = 400;
/** Records calls the page makes to `window.scrollBy`. */
const SCROLL_BY_CALLS = '__fooboardScrollByCalls';

test.use({ viewport: PHONE, hasTouch: true, isMobile: true });
test.skip(
  ({ browserName }) => browserName === 'firefox',
  'Firefox has no mobile emulation',
);

/** How long the board must hold still to count as laid out (ms). */
const SETTLE_MS = 1_000;
/** How many `SETTLE_MS` waits the board gets to hold still. */
const SETTLE_TRIES = 20;

/** What a re-layout would change: the board's box and the zoom. */
async function boardState(grid: Locator, zoom: Locator) {
  const box = await grid.boundingBox();
  return {
    width: box?.width,
    height: box?.height,
    zoom: await zoom.inputValue(),
  };
}

/** The board's state once every cell has filled in (a cell still loading
 * is `aria-busy`; rows fill in one by one, and each may widen the board)
 * and it has stopped changing. */
async function settledState(page: Page, grid: Locator, zoom: Locator) {
  await expect(grid.locator('[aria-busy]')).toHaveCount(0, {
    timeout: SETTLE_MS * SETTLE_TRIES,
  });
  let last = await boardState(grid, zoom);
  for (let i = 0; i < SETTLE_TRIES; i++) {
    await page.waitForTimeout(SETTLE_MS);
    const now = await boardState(grid, zoom);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  throw new Error(`the board never held still: last ${JSON.stringify(last)}`);
}

/** One-finger touch scroll up the page from the board's middle: real
 * touch events in Chromium; elsewhere (no CDP) the window scrolls. */
async function scrollDown(page: Page, browserName: string): Promise<void> {
  const x = PHONE.width / 2;
  const y = PHONE.height / 2;
  if (browserName !== 'chromium') {
    await page.evaluate((px) => {
      window.scrollTo(0, px);
    }, SCROLL_PX);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    at: number,
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }],
    });
  await touch('touchStart', y + SCROLL_PX / 2);
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', y + SCROLL_PX / 2 - (SCROLL_PX * i) / 10);
  }
  await touch('touchEnd', y - SCROLL_PX / 2);
  await cdp.detach();
}

test('a touch scroll on a phone is the browser’s, and the board keeps its size and zoom', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(`{
    window.${SCROLL_BY_CALLS} = 0;
    const scrollBy = window.scrollBy.bind(window);
    window.scrollBy = (...args) => {
      window.${SCROLL_BY_CALLS} += 1;
      scrollBy(...args);
    };
  }`);
  await openDemo(page);
  const grid = page.getByRole('grid', { name: 'Acme platform (demo)' });
  const area = page.getByLabel(/Board: plus and minus zoom/);
  const zoom = page.getByLabel('Zoom', { exact: true });
  await expect(area).toHaveCSS('touch-action', 'pan-x pan-y');
  for (let i = 0; i < ZOOM_STEPS; i++) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
  }
  const before = await settledState(page, grid, zoom);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeGreaterThan(PHONE.height);

  await scrollDown(page, browserName);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(await boardState(grid, zoom)).toEqual(before);
  // Only Chromium's scroll is a touch; elsewhere the test scrolls itself.
  if (browserName === 'chromium') {
    expect(await page.evaluate(`window.${SCROLL_BY_CALLS}`)).toBe(0);
  }

  // The address bar expands, then collapses: only the height changes.
  await page.setViewportSize({
    width: PHONE.width,
    height: PHONE.height - ADDRESS_BAR_PX,
  });
  expect(await boardState(grid, zoom)).toEqual(before);
  await page.setViewportSize(PHONE);
  expect(await boardState(grid, zoom)).toEqual(before);
});
