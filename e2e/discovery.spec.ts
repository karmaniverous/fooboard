/**
 * What crawlers and link previews are served (spec 0.2.0 §3.K), under the
 * locally served CSP and rewrites: `robots.txt` and `sitemap.xml` as files,
 * not the page; `/demo` with its own title while the app still opens the
 * demo; the JSON-LD block loading with no CSP violation (the guard fails a
 * test on any); and the paragraphs on what fooboard is shown only where
 * scripting is off, never while the app loads.
 *
 * @module
 */
import { expect, test } from './guard';

/** The home page's title. */
const HOME_TITLE = "fooboard: Welcome to DevOps hell. Here's your map.";

/** The demo page's title (vite/demoPage.ts). */
const DEMO_TITLE = 'fooboard demo: a simulated deployment status board';

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
  expect(raw).toContain(
    '<link rel="canonical" href="https://www.fooboard.dev/demo" />',
  );
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
