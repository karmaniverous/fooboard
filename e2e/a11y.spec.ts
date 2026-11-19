/**
 * The accessibility pass's automated part (spec.md §3.10), under the
 * locally served CSP: axe finds no WCAG 2.1 A or AA violation (contrast
 * included) on the home page, *Set up with an AI assistant* and an import
 * refusal listing its errors (spec 0.2.0 §3.J), the loading screen
 * (Decision 106) and the error screen, in light and dark (the demo
 * board's own checks are in `a11yDemo.spec.ts`); Tab runs header, then
 * body; the dialogs keep Tab inside; group frames and boundary lines are
 * hidden from assistive technology; and with reduced motion nothing on
 * the board animates.
 *
 * @module
 */
import type { Page } from '@playwright/test';

import { expectAiSetupClean, violations } from './axe';
import { openDemo, PHONE } from './board';
import { expect, test } from './guard';

/** The loading screen, held on the page by blocking the app's scripts
 * (spec 0.2.0 §3.J *The loading screen*): it shows before the app
 * mounts, with the name, the tagline and the link to /ai. */
async function openLoadingScreen(page: Page): Promise<void> {
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'fooboard' }),
  ).toBeVisible();
  await expect(
    page.getByText("Welcome to DevOps hell. Here's your map."),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'https://www.fooboard.dev/ai' }),
  ).toHaveAttribute('href', '/ai');
}

for (const colorScheme of ['light', 'dark'] as const)
  test.describe(`in ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('axe finds no WCAG A or AA violation on the home page', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByRole('main')).toBeVisible();
      expect(await violations(page), 'home').toEqual([]);
    });

    test('axe finds no WCAG A or AA violation in the AI setup dialog or an import refusal', async ({
      page,
    }) => {
      await expectAiSetupClean(page);
    });

    test.describe('on a phone', () => {
      test.use({ viewport: PHONE, hasTouch: true });

      test('axe finds no WCAG A or AA violation in the AI setup dialog or an import refusal', async ({
        page,
      }) => {
        await expectAiSetupClean(page);
      });
    });

    test('axe finds no WCAG A or AA violation on the loading screen', async ({
      page,
    }) => {
      await openLoadingScreen(page);
      expect(await violations(page)).toEqual([]);
    });

    test('axe finds no WCAG A or AA violation on the error screen', async ({
      page,
    }) => {
      // A fresh page, so no cache serves the demo's code.
      await page.route('**/assets/DemoPage-*.js', (route) => route.abort());
      await page.goto('/demo');
      await expect(page.getByRole('alert')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });

test('Tab runs through the header, then the board', async ({ page }) => {
  await openDemo(page);
  const regions: string[] = [];
  while (regions.length < 40 && !regions.includes('grid')) {
    await page.keyboard.press('Tab');
    regions.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (el?.closest('header')) return 'header';
        if (el?.closest('[role=grid]')) return 'grid';
        return el?.closest('main') ? 'main' : 'other';
      }),
    );
  }
  const order = regions.filter((r, i) => r !== regions[i - 1]);
  expect(order.slice(0, 3)).toEqual(['header', 'main', 'grid']);
});

test('dialogs keep Tab inside until closed', async ({ page }) => {
  await openDemo(page);
  const menu = page.getByRole('button', { name: 'Menu' });
  for (const [item, role] of [['Reset…', 'alertdialog']] as const) {
    await menu.click();
    await page.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
    const dialog = page.getByRole(role);
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
  }
});

test('frames and boundary lines are hidden from assistive technology', async ({
  page,
}) => {
  await openDemo(page);
  const exposed = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-frame], [data-boundary]')].filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      ).length,
  );
  expect(
    await page.locator('[data-frame], [data-boundary]').count(),
  ).toBeGreaterThan(0);
  expect(exposed).toBe(0);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing on the board animates', async ({ page }) => {
    await openDemo(page);
    // A run has started: under reduced motion nothing visible marks its
    // cell, so wait for the cell's marker, not for a fixed pause.
    await expect(
      page.locator('main [data-in-progress]').first(),
    ).toBeAttached();
    const animated = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter(
          (el) => getComputedStyle(el).animationName !== 'none',
        ).length,
    );
    expect(animated).toBe(0);
  });

  test("the loading screen's pulse stands still", async ({ page }) => {
    await openLoadingScreen(page);
    await expect(page.locator('.loading-pulse')).toHaveCSS(
      'animation-name',
      'none',
    );
  });
});

test("the loading screen's pulse moves without reduced motion", async ({
  page,
}) => {
  await openLoadingScreen(page);
  await expect(page.locator('.loading-pulse')).toHaveCSS(
    'animation-name',
    'loading-pulse',
  );
});
