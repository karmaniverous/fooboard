/**
 * Tests the Playwright suite's timeouts against the floor (spec 0.2.0
 * §3.F; Decision 88): no `timeout:` option or `test.setTimeout(` argument
 * in `playwright.config.ts` or `e2e/` is under `MIN_TEST_TIMEOUT_MS`, and
 * the scan that says so catches a short literal and an expression that
 * doesn't build on the floor, while leaving pauses alone.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import playwrightConfigRaw from '../playwright.config.ts?raw';
import { shortTimeouts } from './test/timeoutScan';

const e2eSources = import.meta.glob<string>('../e2e/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the timeout scan', () => {
  it('refuses a numeric literal under the floor', () => {
    expect(
      shortTimeouts('await expect(x).toBeVisible({ timeout: 2_000 });'),
    ).toEqual(['2_000']);
    expect(shortTimeouts('test.setTimeout(20000);')).toEqual(['20000']);
  });

  it('refuses an expression that does not reference the floor', () => {
    expect(
      shortTimeouts(
        'await expect(g).toHaveCount(0, {\n  timeout: SETTLE_MS * SETTLE_TRIES,\n});',
      ),
    ).toEqual(['SETTLE_MS * SETTLE_TRIES']);
    expect(shortTimeouts('test.setTimeout(tour(3));')).toEqual(['tour(3)']);
  });

  it('allows the floor, multiples of it and literals at or above it', () => {
    expect(
      shortTimeouts(
        [
          'expect: { timeout: MIN_TEST_TIMEOUT_MS },',
          '}).toPass({ timeout: DRAG_TRIES * MIN_TEST_TIMEOUT_MS });',
          'test.setTimeout(TOUR_TIMEOUTS * MIN_TEST_TIMEOUT_MS);',
          'timeout: 60_000,',
          'test.setTimeout(30_000);',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('never checks pauses', () => {
    expect(
      shortTimeouts(
        [
          'await page.waitForTimeout(2_000);',
          'await new Promise((resolve) => setTimeout(resolve, KEY_SETTLE_MS));',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
});

describe('the Playwright suite', () => {
  it('finds e2e sources to scan', () => {
    expect(Object.keys(e2eSources).length).toBeGreaterThan(0);
  });

  it.each([
    ['playwright.config.ts', playwrightConfigRaw],
    ...Object.entries(e2eSources),
  ])('%s has no timeout under the floor', (_file, source) => {
    expect(shortTimeouts(source)).toEqual([]);
  });
});
