/**
 * The demo board, for the smoke tests: opening it and its first cell.
 *
 * @module
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** The first status cell's link (one Tab stop per cell). */
export const firstCell = (page: Page): Locator =>
  page.getByRole('gridcell').first().getByRole('link').first();

/** Open the demo and wait for its board and its first cell to fill in
 * (slower engines show skeletons for a few seconds). */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo');
  await expect(
    page.getByRole('grid', { name: 'Acme platform (demo)' }),
  ).toBeVisible();
  await expect(firstCell(page)).toBeVisible({ timeout: 20_000 });
}
