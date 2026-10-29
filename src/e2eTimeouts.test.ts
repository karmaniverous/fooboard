/**
 * Tests the Playwright suite's timeouts against the floor (spec 0.2.0
 * §3.F; Decision 88): no timeout option (`timeout`, `actionTimeout`,
 * `navigationTimeout`, written out or shorthand) or `setTimeout` /
 * `setDefaultTimeout` / `setDefaultNavigationTimeout` call in
 * `playwright.config.ts` or `e2e/` is under `MIN_TEST_TIMEOUT_MS`, and
 * the scan that says so catches a short literal and an expression that
 * isn't the floor or a multiple of it, while leaving pauses alone.
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

  it('refuses a fraction of the floor, or anything but the floor or a multiple of it', () => {
    expect(
      shortTimeouts(
        [
          'timeout: MIN_TEST_TIMEOUT_MS / 2,',
          'timeout: 0.5 * MIN_TEST_TIMEOUT_MS,',
          'timeout: MIN_TEST_TIMEOUT_MS - 1_000,',
          'timeout: Math.min(MIN_TEST_TIMEOUT_MS, 5_000),',
        ].join('\n'),
      ),
    ).toEqual([
      'MIN_TEST_TIMEOUT_MS / 2',
      '0.5 * MIN_TEST_TIMEOUT_MS',
      'MIN_TEST_TIMEOUT_MS - 1_000',
      'Math.min(MIN_TEST_TIMEOUT_MS, 5_000)',
    ]);
  });

  it.each([
    ['a fraction without its leading digit', '.5 * MIN_TEST_TIMEOUT_MS'],
    ['the same, after the floor', 'MIN_TEST_TIMEOUT_MS * .5'],
    ['a hex literal', '0x0 * MIN_TEST_TIMEOUT_MS'],
    ['a fraction with digit separators', '0.000_5 * MIN_TEST_TIMEOUT_MS'],
  ])('refuses a factor that is %s', (_form, expression) => {
    expect(shortTimeouts(`timeout: ${expression},`)).toEqual([expression]);
  });

  it.each([
    ['actionTimeout', 'use: { actionTimeout: 5_000 },', '5_000'],
    ['navigationTimeout', 'use: { navigationTimeout: 5_000 },', '5_000'],
    ['setDefaultTimeout', 'page.setDefaultTimeout(5_000);', '5_000'],
    [
      'setDefaultNavigationTimeout',
      'context.setDefaultNavigationTimeout(5_000);',
      '5_000',
    ],
    ['testInfo.setTimeout', 'testInfo.setTimeout(5_000);', '5_000'],
    ['test.info().setTimeout', 'test.info().setTimeout(5_000);', '5_000'],
    ['the shorthand', 'await expect(x).toBeVisible({ timeout });', 'timeout'],
    [
      'the shorthand among others',
      'await page.click(s, { force: true, timeout, trial });',
      'timeout',
    ],
  ])('refuses a short timeout set by %s', (_form, source, expression) => {
    expect(shortTimeouts(source)).toEqual([expression]);
  });

  it('allows the floor, multiples of it and literals at or above it', () => {
    expect(
      shortTimeouts(
        [
          'expect: { timeout: MIN_TEST_TIMEOUT_MS },',
          '}).toPass({ timeout: DRAG_TRIES * MIN_TEST_TIMEOUT_MS });',
          'test.setTimeout(TOUR_TIMEOUTS * MIN_TEST_TIMEOUT_MS);',
          'testInfo.setTimeout(MIN_TEST_TIMEOUT_MS * 2);',
          'timeout: 1 * MIN_TEST_TIMEOUT_MS,',
          'timeout: MIN_TEST_TIMEOUT_MS * 1.5,',
          'timeout: config.retries * MIN_TEST_TIMEOUT_MS,',
          'use: { actionTimeout: MIN_TEST_TIMEOUT_MS },',
          'page.setDefaultTimeout(MIN_TEST_TIMEOUT_MS);',
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
          'await page.evaluate(() => window.setTimeout(done, 10));',
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
