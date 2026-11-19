/**
 * The accessibility pass's axe checks on the demo board (spec.md §3.10),
 * under the locally served CSP, in light and dark: axe finds no WCAG 2.1
 * A or AA violation (contrast included) on the board, a board action's
 * tooltip, the *Unmapped runs* panel with a *Dismiss…* form open and with
 * *Show dismissed* on, the menu, the cell detail sheet and the settings
 * popup, and on a phone on the board, the tooltip and the panel.
 *
 * One test per scan target, each opening the demo itself, so they spread
 * over the workers: a single test touring them all (with the home page and
 * the AI dialog) made eleven scans, seven of them of the whole board, and
 * ran out of time on a busy machine (2026-11-04).
 * Each test still gets `AXE_DEMO_TIMEOUTS` floors.
 *
 * @module
 */
import { MIN_TEST_TIMEOUT_MS } from '../src/test/timeouts';
import {
  expectActionTooltipClean,
  expectUnmappedPanelClean,
  violations,
} from './axe';
import { firstCell, openDemo, PHONE } from './board';
import { expect, test } from './guard';

/** Floors (`MIN_TEST_TIMEOUT_MS`) an axe test on the demo board may
 * take: one full scan of the 21-row board takes about 10 s of CPU alone,
 * up to 50 s with four workers scanning at once, and more on a busy
 * machine, where the 60 s default ran out (2026-11-03 and 2026-11-04). */
const AXE_DEMO_TIMEOUTS = 4;

test.describe.configure({ timeout: AXE_DEMO_TIMEOUTS * MIN_TEST_TIMEOUT_MS });

/** The checks on the board, its tooltip and its panel, at either size. */
function boardActionTests(): void {
  test('axe finds no WCAG A or AA violation on the demo board', async ({
    page,
  }) => {
    await openDemo(page);
    expect(await violations(page), 'demo board').toEqual([]);
  });

  test("axe finds no WCAG A or AA violation on a board action's tooltip", async ({
    page,
  }) => {
    await openDemo(page);
    await expectActionTooltipClean(page);
  });

  test('axe finds no WCAG A or AA violation in the Unmapped runs panel', async ({
    page,
  }) => {
    await openDemo(page);
    await expectUnmappedPanelClean(page);
  });
}

for (const colorScheme of ['light', 'dark'] as const)
  test.describe(`in ${colorScheme}`, () => {
    test.use({ colorScheme });

    boardActionTests();

    test('axe finds no WCAG A or AA violation in the menu', async ({
      page,
    }) => {
      await openDemo(page);
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(await violations(page), 'menu').toEqual([]);
    });

    test('axe finds no WCAG A or AA violation in the cell detail sheet', async ({
      page,
    }) => {
      await openDemo(page);
      await firstCell(page).focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await violations(page), 'cell detail sheet').toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('axe finds no WCAG A or AA violation in the settings popup', async ({
      page,
    }) => {
      await openDemo(page);
      await firstCell(page).focus();
      await page.keyboard.press(',');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await violations(page), 'settings popup').toEqual([]);
    });

    test.describe('on a phone', () => {
      test.use({ viewport: PHONE, hasTouch: true });

      boardActionTests();
    });
  });
