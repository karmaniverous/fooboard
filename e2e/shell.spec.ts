/**
 * What's new, the menu's version and the error screen in the built app
 * (spec.md §3.10, C-20, Decision 25), under the locally served CSP: the
 * dot shows for the bundled changelog's newest release until What's new
 * is opened, and stays gone after a reload; a page that fails to load
 * shows the error screen with the version and a prefilled *Report an
 * issue*, carrying the version, the browser and the message.
 *
 * @module
 */
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { parseChangelog } from '../src/whatsNew/changelog';
import { expect, test } from './guard';

const RELEASES = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
const { version: VERSION } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync('package.json', 'utf8')));

test("What's new marks the newest release until it is opened", async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  const dot = menu.locator('[data-whats-new-dot]');
  await expect(dot).toHaveCount(RELEASES.length > 0 ? 1 : 0);

  await menu.click();
  await expect(page.getByText(`fooboard ${VERSION}`)).toBeVisible();
  await page.getByRole('menuitem', { name: /^What's new/ }).click();
  const dialog = page.getByRole('dialog', { name: "What's new" });
  await expect(dialog).toBeVisible();
  const [newest, older] = RELEASES;
  if (newest === undefined)
    await expect(dialog).toContainText('No releases yet');
  else
    await expect(
      dialog.getByRole('button', { name: new RegExp(`^${newest.version}`) }),
    ).toHaveAttribute('aria-expanded', 'true');
  if (older !== undefined)
    await expect(
      dialog.getByRole('button', { name: new RegExp(`^${older.version}`) }),
    ).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Escape');
  await expect(dot).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(dot).toHaveCount(0);
});

test('a page that fails to load shows the error screen', async ({ page }) => {
  // The demo's code can't be fetched, as after a deploy replaced it.
  await page.route('**/assets/DemoPage-*.js', (route) => route.abort());
  await page.goto('/demo');
  const screen = page.getByRole('alert');
  await expect(screen).toContainText('Something went wrong');
  await expect(screen).toContainText(`fooboard ${VERSION}`);
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();

  const link = page.getByRole('link', { name: 'Report an issue' });
  await expect(link).toHaveAttribute('target', '_blank');
  const issue = new URL((await link.getAttribute('href')) ?? '');
  expect(`${issue.origin}${issue.pathname}`).toBe(
    'https://github.com/karmaniverous/fooboard/issues/new',
  );
  expect([...issue.searchParams.keys()]).toEqual(['title', 'body']);
  const body = issue.searchParams.get('body') ?? '';
  expect(body).toContain(`**fooboard version:** ${VERSION}`);
  expect(body).toContain(
    `**Browser:** ${await page.evaluate(() => navigator.userAgent)}`,
  );
  // The message the screen shows (each browser words its own).
  const message = await screen.locator('pre').textContent();
  expect(message).toBeTruthy();
  expect(body).toContain(`\n${message ?? ''}\n`);
});
