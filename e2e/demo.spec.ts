/**
 * Smoke tests on the demo board (spec.md §3.10, §3.14; Decisions 40 and
 * 53), under the locally served CSP: the board fills in and no request
 * leaves for another host (the guard fails any, and is shown to catch
 * one); every dialog, sheet, popover and drag opens, works and closes,
 * with no CSP violation; on a phone, the settings popup is a bottom sheet.
 *
 * @module
 */
import type { Locator, Page } from '@playwright/test';

import { firstCell, openDemo } from './board';
import { expect, test } from './guard';

/** Time for dnd-kit's keyboard sensor between keys. */
const KEY_SETTLE_MS = 300;

/** `locator`'s box once it has stopped moving (a drop animates). */
async function settledBox(locator: Locator) {
  let last = await locator.boundingBox();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, KEY_SETTLE_MS));
    const box = await locator.boundingBox();
    if (box && last && box.x === last.x && box.y === last.y) return box;
    last = box;
  }
}

/** Press `button` from the keyboard. (WebKit, like Safari, doesn't focus a
 * clicked button, so focus has nothing to return to after a click.) */
async function press(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}

/** Open a modal with `open`, check it, close it with Escape, and check
 * focus went back to `returnsTo`. */
async function roundTrip(
  page: Page,
  open: () => Promise<void>,
  name: string | RegExp,
  returnsTo: Locator,
  role: 'dialog' | 'alertdialog' = 'dialog',
): Promise<void> {
  await open();
  await expect(page.getByRole(role, { name })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole(role)).toHaveCount(0);
  await expect(returnsTo).toBeFocused();
}

test('the demo board fills in and reaches no other host', async ({ page }) => {
  await openDemo(page);
  expect(await page.getByRole('gridcell').count()).toBeGreaterThan(50);
  await expect(page.getByRole('radio', { name: /OK$/ })).toBeVisible();
  // Polls keep running; give them time to ask (the guard fails any
  // request to another host).
  await page.waitForTimeout(3_000);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
});

test('the guard catches a request from the demo to another host', async ({
  page,
  guarded,
}) => {
  await openDemo(page);
  const sent = await page.evaluate(() =>
    fetch('https://api.github.com/zen').then(
      () => 'answered',
      () => 'failed',
    ),
  );
  expect(sent).toBe('failed');
  expect(guarded.offHost).toEqual(['https://api.github.com/zen']);
  // Seen; cleared so the guard's own check passes.
  guarded.offHost.length = 0;
});

test('every dialog, sheet, popover and drag works under the CSP', async ({
  page,
}) => {
  // Many steps: room for a busy machine running the others alongside.
  test.setTimeout(90_000);
  await openDemo(page);
  const cell = firstCell(page);
  await expect(cell).toHaveAttribute('aria-keyshortcuts', 'Space ,');

  // The cell detail sheet (Space) and the settings popup (,).
  await roundTrip(
    page,
    async () => {
      await cell.focus();
      await page.keyboard.press('Space');
    },
    /·/,
    cell,
  );
  await roundTrip(
    page,
    () => page.keyboard.press(','),
    /^Cell settings:/,
    cell,
  );

  // The header's menu dialogs.
  const menu = page.getByRole('button', { name: 'Menu' });
  for (const [item, dialog, role] of [
    ["What's new", "What's new", 'dialog'],
    ['Reset…', 'Reset fooboard?', 'alertdialog'],
  ] as const)
    await roundTrip(
      page,
      async () => {
        await menu.click();
        await page
          .getByRole('menuitem', { name: new RegExp(`^${item}`) })
          .click();
      },
      dialog,
      menu,
      role,
    );
  const header = page.getByRole('navigation', { name: 'App' });
  for (const [button, dialog] of [
    ['Share / Export', 'Share fooboard'],
    ['Import', /^Import/],
  ] as const) {
    const opener = header.getByRole('button', { name: button });
    await roundTrip(page, () => press(page, opener), dialog, opener);
  }

  // The board's panels and popover.
  await page.getByRole('button', { name: 'Legend' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // The counts change as the demo's story plays.
  for (const panel of [/^Problems/, /^Unmapped/, /^Credentials$/]) {
    const opener = page.getByRole('button', { name: panel });
    await roundTrip(page, () => press(page, opener), /./, opener);
  }

  // The dashboard editor: a select, a keyboard drag and a pointer drag.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit dashboard' });
  await editor.getByRole('tab', { name: 'Rows' }).click();
  const rows = editor.getByRole('listitem');
  await expect(rows.first()).toContainText('storefront');
  await editor
    .getByRole('button', { name: 'Drag storefront to reorder' })
    .focus();
  // The sensor attaches its listeners a moment after each key.
  const dragHandle = editor.getByRole('button', {
    name: 'Drag storefront to reorder',
  });
  await page.keyboard.press('Space');
  await expect(dragHandle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(KEY_SETTLE_MS);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(KEY_SETTLE_MS);
  await page.keyboard.press('Space');
  await expect(rows.nth(1)).toContainText('storefront');
  // Measure once the drop has finished moving the item.
  await expect(dragHandle).not.toHaveAttribute('aria-pressed', 'true');
  const box = await settledBox(dragHandle);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 8 });
  await page.mouse.up();
  await expect(rows.first()).toContainText('storefront');

  await editor.getByRole('tab', { name: 'General' }).click();
  await editor.getByRole('button', { name: /^Settings/ }).click();
  await editor.getByRole('combobox').first().click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the settings popup is a bottom sheet whose header stays in view', async ({
    page,
  }) => {
    await openDemo(page);
    const cell = firstCell(page);
    await cell.focus();
    await page.keyboard.press(',');
    const sheet = page.getByRole('dialog', { name: /^Cell settings:/ });
    await expect(sheet).toBeVisible();
    const close = sheet.getByRole('button', { name: 'Close' });
    await expect(close).toBeInViewport();
    await sheet.locator('[data-panel-body]').evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });
    await expect(close).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(cell).toBeFocused();
  });
});
