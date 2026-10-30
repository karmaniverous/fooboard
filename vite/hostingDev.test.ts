// @vitest-environment node
/**
 * `npm run dev` serves the committed Amplify configuration too (spec 0.2.0
 * §3.J *Serving them*): a real dev server with the plugin serves `/ai`
 * from `public/ai.md` as markdown with every header of `customHttp.yml`,
 * and the page with all of them but the CSP.
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { headersFor, parseCustomHttp } from './hosting';
import { CSP_HEADER, CUSTOM_HTTP_FILE, hosting } from './hostingPlugin';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('the dev server with the plugin', () => {
  let server: ViteDevServer;
  let base = '';
  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      root: ROOT,
      logLevel: 'silent',
      plugins: [hosting()],
      server: { port: 0, host: '127.0.0.1', ws: false },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0] ?? '';
  });
  afterAll(async () => {
    await server.close();
  });

  const committed = (url: string) =>
    headersFor(parseCustomHttp(read(CUSTOM_HTTP_FILE)), url);

  it.each(['/ai', '/ai.md'])(
    'serves %s from public/ai.md as markdown, with every committed header',
    async (url) => {
      const res = await fetch(new URL(url, base));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(read('public/ai.md'));
      expect(res.headers.get('content-type')).toBe(
        'text/markdown; charset=utf-8',
      );
      expect(res.headers.get('link')).toBe(committed(url)['Link']);
      for (const [name, value] of Object.entries(committed(url)))
        expect(res.headers.get(name)).toBe(value);
    },
  );

  it('serves the page for a route with every header but the CSP', async () => {
    const res = await fetch(new URL('/d/acme', base));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
    expect(res.headers.get(CSP_HEADER)).toBeNull();
    expect(res.headers.get('link')).toBe(committed('/d/acme')['Link']);
  });
});
