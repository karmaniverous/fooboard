/**
 * What crawlers and link previews are served (spec 0.2.0 §3.K), under the
 * locally served CSP and rewrites: `robots.txt` and `sitemap.xml` as files,
 * not the page; `/demo` with its own title while the app still opens the
 * demo; the JSON-LD block loading with no CSP violation (the guard fails a
 * test on any); and the paragraphs on what fooboard is shown only where
 * scripting is off, never while the app loads; and the app keeping the
 * title and canonical address in step as it moves between the home page
 * and the demo, by link and by Back and Forward.
 *
 * @module
 */
import type { Page } from '@playwright/test';

import { DEMO_HEAD, HOME_HEAD, type PageHead } from '../src/lib/pageHead';
import { expect, test } from './guard';

/** The home page's title. */
const HOME_TITLE = HOME_HEAD.title;

/** The demo page's title. */
const DEMO_TITLE = DEMO_HEAD.title;

/** The page shows `head`'s title and canonical address. */
async function expectHead(page: Page, head: PageHead): Promise<void> {
  await expect(page).toHaveTitle(head.title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    head.url,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    head.url,
  );
}

test('moving between home and the demo inside the app keeps the head in step', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expectHead(page, HOME_HEAD);

  await page
    .getByRole('main')
    .getByRole('link', { name: 'Try the demo' })
    .click();
  await expect(page.getByText('Acme platform (demo)')).toBeVisible();
  await expectHead(page, DEMO_HEAD);

  await page
    .getByRole('banner')
    .getByRole('link', { name: 'fooboard' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expectHead(page, HOME_HEAD);

  await page.goBack();
  await expect(page).toHaveURL(/\/demo$/);
  await expectHead(page, DEMO_HEAD);

  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expectHead(page, HOME_HEAD);
});

test('opened at /demo, moving home gives the home head', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText('Acme platform (demo)')).toBeVisible();
  await expectHead(page, DEMO_HEAD);
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'fooboard' })
    .click();
  await expectHead(page, HOME_HEAD);
  await page.goBack();
  await expectHead(page, DEMO_HEAD);
});

test('robots.txt and sitemap.xml are served as themselves', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await robots.text()).toContain(
    'Sitemap: https://www.fooboard.dev/sitemap.xml',
  );
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  expect(await sitemap.text()).toContain(
    '<loc>https://www.fooboard.dev/demo</loc>',
  );
});

test('/demo has its own title before and after the app starts', async ({
  page,
  request,
}) => {
  const raw = await (await request.get('/demo')).text();
  expect(raw).toContain(`<title>${DEMO_TITLE}</title>`);
  expect(raw).toContain(`<link rel="canonical" href="${DEMO_HEAD.url}" />`);
  await page.goto('/demo');
  await expect(page.getByText('Acme platform (demo)')).toBeVisible();
  await expect(page).toHaveTitle(DEMO_TITLE);
});

test('the home page loads its JSON-LD with no CSP violation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page).toHaveTitle(HOME_TITLE);
  const data: unknown = JSON.parse(
    await page
      .locator('script[type="application/ld+json"]')
      .evaluate((el) => el.textContent),
  );
  expect(data).toMatchObject({ '@type': 'SoftwareApplication' });
});

test('while the app loads, the screen hides what fooboard is', async ({
  page,
}) => {
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.loading-pulse')).toBeVisible();
  await expect(page.locator('.loading-about')).toBeHidden();
});

test.describe('with scripting off', () => {
  test.use({ javaScriptEnabled: false });

  test('the page says what fooboard is, with its links, and no pulse', async ({
    page,
  }) => {
    await page.goto('/');
    const about = page.locator('.loading-about');
    await expect(about).toBeVisible();
    await expect(page.locator('.loading-pulse')).toBeHidden();
    for (const [name, href] of [
      ['Try the demo', '/demo'],
      ['Instructions for AI assistants', '/ai'],
      ['llms.txt', '/llms.txt'],
      [
        'Source code and user guide on GitHub',
        'https://github.com/karmaniverous/fooboard',
      ],
      [
        'Welcome to DevOps hell',
        'https://karmanivero.us/welcome-to-devops-hell/',
      ],
    ])
      await expect(about.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
  });
});
