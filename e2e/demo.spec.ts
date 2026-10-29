/**
 * Smoke tests on the demo board (spec.md §3.10, §3.14; Decisions 40 and
 * 53), under the locally served CSP: the board fills in and no request
 * leaves for another host (the guard fails any, and is shown to catch
 * one); every dialog, sheet, popover and drag opens, works and closes,
 * with no CSP violation; an unmapped run is dismissed with a preset,
 * listed under *Show dismissed* and brought back with *Undo* (spec 0.2.0
 * §3.I); on a phone, the settings popup is a bottom sheet.
 *
 * @module
 */
import type { Locator, Page } from '@playwright/test';

import { MIN_TEST_TIMEOUT_MS } from '../src/test/timeouts';
import { firstCell, openDemo } from './board';
import { expect, test } from './guard';

/** Time for dnd-kit's keyboard sensor between keys. */
const KEY_SETTLE_MS = 300;

/** How many lost `ArrowDown` presses the drag retry allows for: each
 * waits `MIN_TEST_TIMEOUT_MS` for the item to move (Decision 99). */
const DRAG_TRIES = 3;

/** The editor tour's whole budget, in `MIN_TEST_TIMEOUT_MS`: the drag
 * retry's `DRAG_TRIES`, plus room for every other step. */
const TOUR_TIMEOUTS = 6;

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
  test.setTimeout(TOUR_TIMEOUTS * MIN_TEST_TIMEOUT_MS);
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
  const legend = page.getByRole('button', { name: 'Legend' });
  await legend.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // Its focus returns once it has closed (a second later in Firefox
  // here), and would take the next key press with it.
  await expect(legend).toBeFocused();
  // The counts change as the demo's story plays.
  for (const panel of [
    /^Problems \(\d+\)$/,
    /^Unmapped runs \(\d+\)$/,
    /^Credentials$/,
  ]) {
    const opener = page.getByRole('button', { name: panel });
    await roundTrip(page, () => press(page, opener), /./, opener);
  }

  // The dashboard editor: a select, a keyboard drag and a pointer drag.
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit dashboard' });
  // The panel focuses its selected tab once open (late in Firefox here);
  // wait, so it can't take focus from the drag handle.
  await expect(editor.getByRole('tab', { selected: true })).toBeFocused();
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
  // dnd-kit's live region says where the item is. Its sensor listens from a
  // timer after the pick-up, which a busy Firefox can run late, losing the
  // key; so press again until the item has moved one place.
  const live = page.locator('[id^="DndLiveRegion"]');
  await expect(async () => {
    await page.keyboard.press('ArrowDown');
    await expect(live).toContainText('moved over droppable area mobile-web', {
      timeout: MIN_TEST_TIMEOUT_MS,
    });
  }).toPass({ timeout: DRAG_TRIES * MIN_TEST_TIMEOUT_MS });
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

test('dismisses an unmapped run with a preset, shows it and undoes it', async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole('button', { name: /^Unmapped runs \(\d+\)$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Unmapped runs' });
  const entries = panel.getByRole('list').first();
  const first = entries.getByRole('listitem').first();
  const title = (await first.getByRole('link').first().innerText()).trim();
  const runLink = (scope: Locator) =>
    scope.getByRole('link', { name: title, exact: true });
  await first.getByRole('button', { name: 'Dismiss…' }).click();
  await expect(panel.getByRole('radio').first()).toBeFocused();
  await panel.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(panel.getByRole('heading', { level: 3 })).toBeFocused();
  await expect(runLink(entries)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Show dismissed' }).click();
  const dismissed = panel.getByRole('list', { name: 'Dismissed runs' });
  await expect(runLink(dismissed).first()).toBeVisible();
  await dismissed.getByRole('button', { name: 'Undo' }).first().click();
  await expect(runLink(entries).first()).toBeVisible();
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
