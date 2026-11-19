/**
 * axe for the accessibility pass (spec.md §3.10): its scan of a page
 * against WCAG 2.1 A and AA once the page has stopped moving, and the
 * checks the light, dark and phone tests share (a board action's tooltip,
 * the *Unmapped runs* panel and *Set up with an AI assistant* with an
 * import refusal).
 *
 * @module
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { REFUSED_FRAGMENT } from './aiShare';
import { expect } from './guard';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** axe's violations on the page once its opening and closing
 * transitions have ended (colours mid-fade aren't the page's): rule, and
 * where. */
export async function violations(page: Page): Promise<string[]> {
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

/** axe finds nothing on a board action's tooltip, shown by keyboard
 * focus (spec 0.2.0 §3.A). */
export async function expectActionTooltipClean(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit dashboard' }).focus();
  await expect(page.getByRole('tooltip')).toHaveText('Edit dashboard');
  expect(await violations(page), 'board action tooltip').toEqual([]);
  await page.keyboard.press('Escape');
}

/** axe finds nothing in the *Unmapped runs* panel with an entry's
 * *Dismiss…* form open, then with *Show dismissed* on (spec 0.2.0
 * §3.I). */
export async function expectUnmappedPanelClean(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Unmapped runs \(\d+\)$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Unmapped runs' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Dismiss…' }).first().click();
  await expect(panel.getByRole('form')).toBeVisible();
  expect(await violations(page), 'dismiss form').toEqual([]);
  await panel.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await panel.getByRole('button', { name: 'Show dismissed' }).click();
  await expect(
    panel.getByRole('list', { name: 'Dismissed runs' }),
  ).toBeVisible();
  expect(await violations(page), 'show dismissed').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
}

/** axe finds nothing in *Set up with an AI assistant*, opened from the
 * home page, at rest and after *Copy prompt* (its check or its failure
 * announced, the button's tooltip showing; Decision 108), nor in an import
 * refusal listing its errors (spec 0.2.0 §3.J). */
export async function expectAiSetupClean(page: Page): Promise<void> {
  await page.goto('/');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Set up with an AI assistant…' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Set up with an AI assistant',
  });
  await expect(dialog).toBeVisible();
  expect(await violations(page), 'AI setup dialog').toEqual([]);
  await dialog.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(dialog.getByRole('status').filter({ hasText: /./ })).toHaveCount(
    1,
  );
  expect(await violations(page), 'AI setup dialog after a copy').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.goto(`/${REFUSED_FRAGMENT}`);
  const refusal = page.getByRole('dialog', { name: 'Import dashboards' });
  await expect(
    refusal.getByRole('list', { name: 'Import errors' }),
  ).toBeVisible();
  expect(await violations(page), 'import refusal').toEqual([]);
  await page.keyboard.press('Escape');
}
