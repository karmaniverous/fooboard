/**
 * The locally served headers the smoke tests run under (spec.md §3.10,
 * Decision 40): every kind of response carries exactly the headers of
 * `customHttp.yml` (the `'**'` pattern's, merged with a one-path
 * pattern's), so the other tests run under the policy that ships; and the
 * instructions for AI assistants are served and pointed to as Amplify
 * will serve them (spec 0.2.0 §3.J *Serving them*, *Discovery*).
 *
 * @module
 */
import { readFileSync } from 'node:fs';

import { headersFor, parseCustomHttp } from '../vite/hosting';
import { expect, test } from './guard';

const HOSTING = parseCustomHttp(readFileSync('customHttp.yml', 'utf8'));
const MARKDOWN = 'text/markdown; charset=utf-8';

test('every response carries the headers of customHttp.yml', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const script = await page
    .locator('script[type="module"]')
    .first()
    .getAttribute('src');
  for (const [path, status] of [
    ['/', 200],
    ['/demo', 200],
    ['/d/some-dashboard', 200],
    [script ?? '', 200],
    ['/assets/missing.js', 404],
    ['/ai', 200],
    ['/ai.md', 200],
    ['/ai.schema.json', 200],
    ['/llms.txt', 200],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    const served = response.headers();
    expect(served.link, `${path}: Link`).toBe(HOSTING.every.Link);
    for (const [key, value] of Object.entries(headersFor(HOSTING, path)))
      expect(served[key.toLowerCase()], `${path}: ${key}`).toBe(value);
  }
});

test('/ai is a rewrite, not a redirect, to the instructions as markdown', async ({
  request,
}) => {
  const ai = await request.get('/ai', { maxRedirects: 0 });
  expect(ai.status()).toBe(200);
  expect(ai.headers().location).toBeUndefined();
  const md = await request.get('/ai.md');
  for (const response of [ai, md]) {
    expect(response.headers()['content-type']).toBe(MARKDOWN);
    expect(await response.text()).toContain(
      '# fooboard: set up a board, for AI assistants',
    );
  }
});

test('the schema answers JSON and llms.txt text', async ({ request }) => {
  const schema = await request.get('/ai.schema.json');
  expect(schema.headers()['content-type']).toMatch(/^application\/json/);
  expect(await schema.json()).toMatchObject({ title: 'fooboard share' });
  const llms = await request.get('/llms.txt');
  expect(llms.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await llms.text()).toContain('https://www.fooboard.dev/ai');
});

test('the page points to /ai without running a script', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(
    /<div id="root">[\s\S]*read\s*<a href="\/ai">https:\/\/www\.fooboard\.dev\/ai<\/a>\.\s*<\/p>/,
  );
  expect(html).toContain('rel="alternate"');
  expect(html).toMatch(/<link[^>]*type="text\/markdown"[^>]*href="\/ai"/);
  expect(html).toMatch(
    /<meta\s+property="og:description"\s+content="[^"]*https:\/\/www\.fooboard\.dev\/ai\."/,
  );
});
