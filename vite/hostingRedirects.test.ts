// @vitest-environment node
/**
 * The middleware's redirects (Decision 110): a redirect from a full URL
 * (the committed apex redirect) names another host and is skipped locally;
 * a redirect from a plain path is answered its status and `Location`.
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

/** The committed rules with a redirect of `status` from `/old` first. */
const withPathRedirect = (status: string): string =>
  JSON.stringify([
    { source: '/old', status, target: 'https://example.com/new' },
    ...z.array(z.unknown()).parse(JSON.parse(read(REWRITES_FILE))),
  ]);

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
        expect(r.headers.get('Location')).toBe('https://example.com/new');
        expect(r.headers.get('X-A')).toBe('a');
        expect(r.end).toHaveBeenCalledOnce();
        expect(r.next).not.toHaveBeenCalled();
      },
    );
  });

  it('leaves any other path to the rewrites', () => {
    const r = serve('/older', undefined, withPathRedirect('301'));
    expect(r.url).toBe(SPA_ENTRY);
    expect(r.headers.has('Location')).toBe(false);
  });
});
