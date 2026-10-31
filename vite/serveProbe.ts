/**
 * A test probe for {@link hostingMiddleware}: runs it on one request over
 * a fake request and response and reports what it did. Shared by the
 * middleware's tests (`hostingPlugin.test.ts`, `hostingRedirects.test.ts`).
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type Mock, vi } from 'vitest';

import {
  CSP_HEADER,
  hostingMiddleware,
  REWRITES_FILE,
} from './hostingPlugin.ts';
import { parseRewrites } from './hostingRules.ts';

/** The repository root. */
export const ROOT = path.resolve(import.meta.dirname, '..');

/** A file of the repository, as text. */
export const read = (file: string): string =>
  readFileSync(path.join(ROOT, file), 'utf8');

/** What the middleware did with one request. */
export interface Served {
  /** The request's URL afterwards (rewritten, or as it came). */
  url: string | undefined;
  /** The response headers it set. */
  headers: Map<string, string>;
  /** The response status. */
  status: number;
  /** Called when it passed the request on. */
  next: Mock;
  /** Called when it answered the request itself. */
  end: Mock;
}

/** Runs the middleware on one request, with `'**'` headers `X-A` and the
 * CSP, `/ai`'s markdown type and the rules of `rewritesFile` (by default
 * the committed file); what it did. `exists` says which files a preview
 * build has; `'dev'` runs the dev server's middleware. */
export function serve(
  url: string | undefined,
  exists: ((sitePath: string) => boolean) | 'dev' = (p) => p === '/assets/a.js',
  rewritesFile = read(REWRITES_FILE),
): Served {
  const req = { url };
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => headers.set(name, value),
    end: vi.fn(),
  };
  const next = vi.fn();
  const config = {
    headers: {
      every: { 'X-A': 'a', [CSP_HEADER]: 'csp' },
      byPath: { '/ai': { 'Content-Type': 'text/markdown' } },
    },
    ...parseRewrites(rewritesFile),
  };
  hostingMiddleware(
    exists === 'dev'
      ? { ...config, server: 'dev' }
      : { ...config, server: 'preview', exists },
  )(req, res, next);
  return { url: req.url, headers, status: res.statusCode, next, end: res.end };
}
