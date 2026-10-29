/**
 * The demo board, for the smoke tests: opening it and its first cell,
 * and the phone viewport the phone checks use.
 *
 * @module
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** An iPhone's viewport with its toolbars collapsed (CSS px). */
export const PHONE = { width: 390, height: 844 };

/** The first status cell's link (one Tab stop per cell). */
export const firstCell = (page: Page): Locator =>
  page.getByRole('gridcell').first().getByRole('link').first();

/** Open the demo and wait for its board and its first cell to fill in
 * (slower engines show skeletons for a few seconds, well inside the
 * default assertion timeout). */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo');
  await expect(
    page.getByRole('grid', { name: 'Acme platform (demo)' }),
  ).toBeVisible();
  await expect(firstCell(page)).toBeVisible();
}
