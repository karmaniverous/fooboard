/**
 * The accessibility pass's automated part (spec.md §3.10), under the
 * locally served CSP: axe finds no WCAG 2.1 A or AA violation (contrast
 * included) on the home page, the demo board, What's new, the cell
 * detail sheet, the settings popup and the error screen, in light and
 * dark; Tab runs header, then body; the dialogs keep Tab inside; group
 * frames and boundary lines are hidden from assistive technology; and
 * with reduced motion nothing on the board animates.
 *
 * @module
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { firstCell, openDemo } from './board';
import { expect, test } from './guard';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** axe's violations on the page once its opening and closing
 * transitions have ended (colours mid-fade aren't the page's): rule, and
 * where. */
async function violations(page: Page): Promise<string[]> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== 'running' ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );
  const { violations: found } = await new AxeBuilder({ page })
    .withTags(WCAG)
    // Experimental in axe (WCAG 2.5.3, label in name), so off by default;
    // the tags turn it on. Its findings on the board are recorded in the
    // accessibility pass for the owner (the diverged badge's "1/2", named
    // "diverged: 1 commit behind, 2 commits ahead of its source").
    .disableRules(['label-content-name-mismatch'])
    .analyze();
  return found.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`),
  );
}

for (const colorScheme of ['light', 'dark'] as const)
  test.describe(`in ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('axe finds no WCAG A or AA violation', async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto('/');
      await expect(page.getByRole('main')).toBeVisible();
      expect(await violations(page), 'home').toEqual([]);

      await openDemo(page);
      expect(await violations(page), 'demo board').toEqual([]);

      const menu = page.getByRole('button', { name: 'Menu' });
      await menu.click();
      expect(await violations(page), 'menu').toEqual([]);
      await page.getByRole('menuitem', { name: /^What's new/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await violations(page), "What's new").toEqual([]);
      await page.keyboard.press('Escape');

      await firstCell(page).focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await violations(page), 'cell detail sheet').toEqual([]);
      await page.keyboard.press('Escape');

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await firstCell(page).focus();
      await page.keyboard.press(',');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await violations(page), 'settings popup').toEqual([]);
      await page.keyboard.press('Escape');
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
  for (const [item, role] of [
    ["What's new", 'dialog'],
    ['Reset…', 'alertdialog'],
  ] as const) {
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
});
