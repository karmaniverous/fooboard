/**
 * The locally served headers the smoke tests run under (spec.md §3.10,
 * Decision 40): every kind of response carries exactly the headers of
 * `customHttp.yml`, so the other tests run under the policy that ships.
 *
 * @module
 */
import { readFileSync } from 'node:fs';

import { parseCustomHttp } from '../vite/hosting';
import { expect, test } from './guard';

const HEADERS = parseCustomHttp(readFileSync('customHttp.yml', 'utf8'));

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
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    const served = response.headers();
    for (const [key, value] of Object.entries(HEADERS))
      expect(served[key.toLowerCase()], `${path}: ${key}`).toBe(value);
  }
});
