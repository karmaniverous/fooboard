/**
 * *Release notes*, the menu's version and the error screen in the built
 * app (spec 0.2.0 §3.D; spec.md §3.10, C-20, Decision 25), under the
 * locally served CSP: for a browser that last saw an older version, the
 * dot shows on the menu button and the item, the item links to the
 * releases page in a new tab, and following it clears the dot, which
 * stays gone after a reload; a first visit shows no dot; a page that
 * fails to load shows the error screen with the version and a prefilled
 * *Report an issue*, carrying the version, the browser and the message.
 * Setting up with an AI assistant (spec 0.2.0 §3.J): `/ai`'s example `#j=`
 * link, a one-dashboard share with one credential, imports and lands on the board
 * with the credentials panel open on that credential; pasting the same
 * share's JSON into *Import* imports it; the dialog opens from the header
 * and from the home page, names the preview site's own `/ai`, and its
 * *Copy instructions* copies the site's `/ai.md` (Decision 107).
 *
 * @module
 */
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { CURRENT_DEVICE_PREFERENCES_VERSION } from '../src/domain/config/devicePreferences';
import { KEY_PREFIX } from '../src/storage/keyValue';
import {
  AI_BOARD_PATH,
  AI_CREDENTIAL,
  AI_LINK_FRAGMENT,
  AI_SHARE_JSON,
} from './aiShare';
import { expect, test } from './guard';

const { version: VERSION } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync('package.json', 'utf8')));

/** The releases page *Release notes* links to. */
const RELEASES_PAGE = 'https://github.com/karmaniverous/fooboard/releases';

/** The device preferences' key (`DEVICE_PREFERENCES_KEY`, whose module
 * the e2e build can't import). */
const DEVICE_KEY = `${KEY_PREFIX}device`;

/** A version older than any build's. */
const OLDER = '0.0.1';

test('Release notes marks a version newer than the one last seen, until followed', async ({
  page,
}) => {
  // Seeded once: a reload keeps what the page stored since.
  const prefs = JSON.stringify({
    schemaVersion: CURRENT_DEVICE_PREFERENCES_VERSION,
    lastSeenVersion: OLDER,
  });
  await page.addInitScript(
    `if (localStorage.getItem(${JSON.stringify(DEVICE_KEY)}) === null)
      localStorage.setItem(${JSON.stringify(DEVICE_KEY)}, ${JSON.stringify(prefs)});`,
  );
  // The releases page opens in a tab of its own, answered here.
  await page
    .context()
    .route(RELEASES_PAGE, (route) => route.fulfill({ body: 'Releases' }));
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  const dot = page.locator('[data-release-notes-dot]');
  await expect(menu.locator('[data-release-notes-dot]')).toHaveCount(1);

  await menu.click();
  await expect(page.getByText(`fooboard ${VERSION}`)).toBeVisible();
  const item = page.getByRole('menuitem', {
    name: 'Release notes (new release)',
  });
  await expect(item).toHaveAttribute('href', RELEASES_PAGE);
  await expect(item).toHaveAttribute('target', '_blank');
  await expect(item.locator('[data-release-notes-dot]')).toHaveCount(1);
  const popup = page.waitForEvent('popup');
  await item.click();
  await (await popup).close();

  await expect(dot).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(dot).toHaveCount(0);
});

test('a first visit shows no release-notes dot', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Release notes', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-release-notes-dot]')).toHaveCount(0);
});

test('a #j= link imports and asks for its key on the board', async ({
  page,
}) => {
  await page.goto(`/${AI_LINK_FRAGMENT}`);
  const dialog = page.getByRole('dialog', { name: 'Import dashboards' });
  await expect(dialog.getByText('This link holds 1 dashboard.')).toBeVisible();
  // The fragment is gone before anything else.
  expect(new URL(page.url()).hash).toBe('');
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(page).toHaveURL(new RegExp(`${AI_BOARD_PATH}$`));
  const panel = page.getByRole('dialog', { name: 'Credentials' });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('button', { name: new RegExp(`^${AI_CREDENTIAL}`) }),
  ).toHaveAttribute('aria-expanded', 'true');
  // Its secret's field, first in the open item, asks for the key.
  await expect(panel.getByLabel('Token').first()).toBeVisible();
});

test("pasting a share's JSON into Import imports it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Import', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Import dashboards' });
  await dialog
    .getByLabel('Or a fooboard link, or its JSON')
    .fill(AI_SHARE_JSON ?? '');
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(page).toHaveURL(new RegExp(`${AI_BOARD_PATH}$`));
  await expect(page.getByRole('dialog', { name: 'Credentials' })).toBeVisible();
});

test('Set up with an AI assistant opens from the header and the home page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const dialog = page.getByRole('dialog', {
    name: 'Set up with an AI assistant',
  });
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Set up with an AI assistant' })
    .click();
  await expect(dialog).toBeVisible();
  // The preview server isn't production, so the dialog names its own /ai
  // (Decision 107).
  await expect(
    dialog.getByLabel('Instructions for your assistant'),
  ).toHaveValue(`${new URL(page.url()).origin}/ai`);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Set up with an AI assistant…' })
    .click();
  await expect(dialog).toBeVisible();
});

test("Copy instructions copies this site's /ai.md, off production", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Set up with an AI assistant…' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Set up with an AI assistant',
  });
  await expect(dialog).toContainText("An assistant can't reach this site");
  await dialog.getByRole('button', { name: 'Copy instructions' }).click();
  await expect(dialog).toContainText('Instructions copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Windows' clipboard hands text back with CRLF line ends.
  expect(copied.replaceAll('\r\n', '\n')).toBe(
    await (await request.get('/ai.md')).text(),
  );
});

test('a page that fails to load shows the error screen', async ({ page }) => {
  // The demo's code can't be fetched, as after a deploy replaced it.
  await page.route('**/assets/DemoPage-*.js', (route) => route.abort());
  await page.goto('/demo');
  const screen = page.getByRole('alert');
  await expect(screen).toContainText('Something went wrong');
  await expect(screen).toContainText(`fooboard ${VERSION}`);
  const reload = page.getByRole('button', { name: 'Reload' });
  await expect(reload).toBeVisible();

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

  // Reload loads the page again (here, to the same error).
  await Promise.all([page.waitForEvent('load'), reload.click()]);
  await expect(page.getByRole('alert')).toBeVisible();
});
