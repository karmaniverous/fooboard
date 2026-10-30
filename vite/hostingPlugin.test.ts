// @vitest-environment node
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { build, preview, type PreviewServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { headersFor, parseCustomHttp } from './hosting';
import {
  CSP_HEADER,
  CUSTOM_HTTP_FILE,
  hosting,
  REWRITES_FILE,
  sitePaths,
  within,
} from './hostingPlugin';
import { SPA_ENTRY } from './hostingRules';
import { read, ROOT, serve } from './serveProbe';

/** A fresh temporary directory. */
const tempDir = (name: string) =>
  mkdtempSync(path.join(tmpdir(), `fooboard-${name}-`));

describe('hostingMiddleware', () => {
  it('sets every header, then serves the page for a route', () => {
    const r = serve('/d/acme?x=1');
    expect(Object.fromEntries(r.headers)).toEqual({
      'X-A': 'a',
      [CSP_HEADER]: 'csp',
    });
    expect(r.url).toBe(`${SPA_ENTRY}?x=1`);
    expect(r.next).toHaveBeenCalledOnce();
  });

  it("merges '**' with the requested path's own headers, then serves the rewrite's file", () => {
    const r = serve('/ai');
    expect(Object.fromEntries(r.headers)).toEqual({
      'X-A': 'a',
      [CSP_HEADER]: 'csp',
      'Content-Type': 'text/markdown',
    });
    expect(r.url).toBe('/ai.md');
    expect(r.next).toHaveBeenCalledOnce();
  });

  describe('on the dev server', () => {
    it("rewrites /ai to /ai.md with every header and the path's own", () => {
      const r = serve('/ai?x=1', 'dev');
      expect(Object.fromEntries(r.headers)).toEqual({
        'X-A': 'a',
        [CSP_HEADER]: 'csp',
        'Content-Type': 'text/markdown',
      });
      expect(r.url).toBe('/ai.md?x=1');
      expect(r.next).toHaveBeenCalledOnce();
    });

    it.each(['/d/acme', '/', SPA_ENTRY, '/@vite/client'])(
      'leaves %s to Vite, with every header but the CSP',
      (url) => {
        const r = serve(url, 'dev');
        expect(Object.fromEntries(r.headers)).toEqual({ 'X-A': 'a' });
        expect(r.url).toBe(url);
        expect(r.next).toHaveBeenCalledOnce();
      },
    );

    it('leaves a path that is not a file to Vite, with the CSP', () => {
      const r = serve('/node_modules/.vite/deps/react.js', 'dev');
      expect(r.headers.get(CSP_HEADER)).toBe('csp');
      expect(r.status).toBe(200);
      expect(r.next).toHaveBeenCalledOnce();
      expect(r.end).not.toHaveBeenCalled();
    });
  });

  it('serves the page for a request with no URL, as for the root', () => {
    expect(serve(undefined).url).toBe(SPA_ENTRY);
  });

  it('passes an existing file through unchanged', () => {
    const r = serve('/assets/a.js');
    expect(r.url).toBe('/assets/a.js');
    expect(r.next).toHaveBeenCalledOnce();
  });

  it('answers a missing asset 404, with the headers, never the page', () => {
    const r = serve('/assets/gone.js');
    expect(r.status).toBe(404);
    expect(r.headers.get('X-A')).toBe('a');
    expect(r.next).not.toHaveBeenCalled();
    expect(r.end).toHaveBeenCalledOnce();
  });

  it('answers a malformed escape 404 rather than throwing', () => {
    const exists = vi.fn(() => true);
    const r = serve('/assets/%E0%A4%A.js', exists);
    expect(r.status).toBe(404);
    expect(r.headers.get('X-A')).toBe('a');
    expect(exists).not.toHaveBeenCalled();
  });

  it('decodes the path before asking whether the file exists', () => {
    const exists = vi.fn(() => true);
    serve('/assets/a%20b.js', exists);
    expect(exists).toHaveBeenCalledWith('/assets/a b.js');
  });
});

describe('within', () => {
  it('resolves a site path inside the directory', () => {
    expect(within('/srv/dist', '/assets/a.js')).toBe(
      path.resolve('/srv/dist/assets/a.js'),
    );
  });

  it.each(['/../secret.txt', '/assets/../../secret.txt', '/'])(
    'refuses %s, which is not a file inside it',
    (sitePath) => {
      expect(within('/srv/dist', sitePath)).toBeUndefined();
    },
  );
});

describe('sitePaths', () => {
  let dir = '';
  beforeAll(() => {
    dir = tempDir('site');
    mkdirSync(path.join(dir, 'icons'));
    writeFileSync(path.join(dir, 'a.svg'), '');
    writeFileSync(path.join(dir, 'icons', 'b.png'), '');
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists every file below the directory as a site path', () => {
    expect(sitePaths(dir).sort()).toEqual(['/a.svg', '/icons/b.png']);
  });

  it.each(['', path.join(tmpdir(), 'fooboard-no-such-dir')])(
    'lists nothing for %j',
    (missing) => {
      expect(sitePaths(missing)).toEqual([]);
    },
  );
});

describe('the build check', () => {
  /** Builds a one-page app with the committed rewrite and these files in
   * `public/`. */
  async function buildWith(publicFiles: string[]): Promise<void> {
    const root = tempDir('app');
    try {
      copyFileSync(
        path.join(ROOT, REWRITES_FILE),
        path.join(root, REWRITES_FILE),
      );
      writeFileSync(path.join(root, 'index.html'), '<!doctype html><p>app</p>');
      mkdirSync(path.join(root, 'public'));
      for (const file of publicFiles)
        writeFileSync(path.join(root, 'public', file), '');
      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [hosting()],
        build: { write: false },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('passes a build whose files the rewrite leaves alone', async () => {
    await expect(buildWith(['favicon.svg'])).resolves.toBeUndefined();
  });

  it('fails a build with a file the rewrite would answer with the page', async () => {
    await expect(buildWith(['favicon.svg', 'LICENSE'])).rejects.toThrow(
      `${REWRITES_FILE} would serve the page for /LICENSE`,
    );
  });
});

describe('vite preview with the plugin', () => {
  let server: PreviewServer;
  let base = '';
  let outDir = '';
  beforeAll(async () => {
    outDir = tempDir('dist');
    mkdirSync(path.join(outDir, 'assets'));
    writeFileSync(
      path.join(outDir, 'index.html'),
      '<!doctype html><p>page</p>',
    );
    writeFileSync(path.join(outDir, 'assets', 'a.js'), 'export {};');
    writeFileSync(path.join(outDir, 'ai.md'), '# For assistants');
    server = await preview({
      configFile: false,
      root: ROOT,
      logLevel: 'silent',
      plugins: [hosting()],
      build: { outDir },
      preview: { port: 0, host: '127.0.0.1' },
    });
    base = server.resolvedUrls?.local[0] ?? '';
  });
  afterAll(async () => {
    await server.close();
    rmSync(outDir, { recursive: true, force: true });
  });

  it.each([
    ['/', 200, 'page'],
    ['/demo', 200, 'page'],
    ['/d/acme', 200, 'page'],
    ['/assets/a.js', 200, 'export {};'],
    ['/assets/gone.js', 404, ''],
    ['/ai', 200, '# For assistants'],
    ['/ai.md', 200, '# For assistants'],
  ])(
    'serves %s as %i with the committed headers',
    async (url, status, body) => {
      const res = await fetch(new URL(url, base));
      expect(res.status).toBe(status);
      expect(await res.text()).toContain(body);
      for (const [name, value] of Object.entries(
        headersFor(parseCustomHttp(read(CUSTOM_HTTP_FILE)), url),
      ))
        expect(res.headers.get(name)).toBe(value);
    },
  );

  it.each(['/ai', '/ai.md'])(
    "serves %s as markdown, over the file server's own type",
    async (url) => {
      const res = await fetch(new URL(url, base));
      expect(res.headers.get('content-type')).toBe(
        'text/markdown; charset=utf-8',
      );
    },
  );
});
