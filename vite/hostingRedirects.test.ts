// @vitest-environment node
/**
 * The middleware's redirects (Decision 110): a redirect from a full URL
 * (the committed apex redirect) names another host and is skipped locally;
 * a redirect from a plain path is answered its status and `Location`, the
 * request's query carried over unless the target has its own. A
 * rule with a country `condition` is skipped locally, redirect or rewrite.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { REWRITES_FILE } from './hostingPlugin';
import { REDIRECT_STATUSES, SPA_ENTRY } from './hostingRules';
import { read, serve } from './serveProbe';

const SERVERS = ['preview', 'dev'] as const;

/** The probe's `exists` argument for `server`: the default build's for
 * preview. */
const on = (server: (typeof SERVERS)[number]) =>
  server === 'dev' ? 'dev' : undefined;

/** The committed rules with `first` before them. */
const withFirst = (first: object): string =>
  JSON.stringify([
    first,
    ...z.array(z.unknown()).parse(JSON.parse(read(REWRITES_FILE))),
  ]);

/** The committed rules with a redirect of `status` from `/old` to
 * `target` first. */
const withPathRedirect = (
  status: string,
  target = 'https://example.com/new',
): string => withFirst({ source: '/old', status, target });

describe('hostingMiddleware redirects', () => {
  it.each(SERVERS)(
    'skips the committed full-URL redirect on %s: / is the page, not a redirect',
    (server) => {
      const r = serve('/', on(server));
      expect(r.status).toBe(200);
      expect(r.headers.has('Location')).toBe(false);
      expect(r.end).not.toHaveBeenCalled();
      expect(r.next).toHaveBeenCalledOnce();
    },
  );

  describe.each(SERVERS)('on %s', (server) => {
    it.each(REDIRECT_STATUSES)(
      'answers a %s path redirect with its status, Location and headers',
      (status) => {
        const r = serve('/old?x=1', on(server), withPathRedirect(status));
        expect(r.status).toBe(Number(status));
        expect(r.headers.get('Location')).toBe('https://example.com/new?x=1');
        expect(r.headers.get('X-A')).toBe('a');
        expect(r.end).toHaveBeenCalledOnce();
        expect(r.next).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    ['no query of its own', '/new', '/old?x=1', '/new?x=1'],
    ['a fragment', '/new#top', '/old?x=1', '/new?x=1#top'],
    [
      'its own query',
      'https://example.com/new?y=2#top',
      '/old?x=1',
      'https://example.com/new?y=2#top',
    ],
    ['a request with no query', '/new#top', '/old', '/new#top'],
  ])(
    'carries the query over (or not) to a target with %s, as Amplify does',
    (_why, target, url, expected) => {
      const r = serve(url, undefined, withPathRedirect('302', target));
      expect(r.headers.get('Location')).toBe(expected);
    },
  );

  it('leaves any other path to the rewrites', () => {
    const r = serve('/older', undefined, withPathRedirect('301'));
    expect(r.url).toBe(SPA_ENTRY);
    expect(r.headers.has('Location')).toBe(false);
  });
});

describe('hostingMiddleware conditions', () => {
  it('skips a redirect with a country condition', () => {
    const r = serve(
      '/old',
      undefined,
      withFirst({
        source: '/old',
        status: '302',
        target: '/new',
        condition: '<US>',
      }),
    );
    expect(r.headers.has('Location')).toBe(false);
    expect(r.url).toBe(SPA_ENTRY);
  });

  it('skips a rewrite with a country condition, applying the next rule', () => {
    const r = serve(
      '/ai',
      undefined,
      JSON.stringify([
        { source: '/ai', status: '200', target: '/ai.txt', condition: '<US>' },
        { source: '/ai', status: '200', target: '/ai.md', condition: null },
        { source: '</^[^.]+$/>', status: '200', target: SPA_ENTRY },
      ]),
    );
    expect(r.url).toBe('/ai.md');
  });
});
