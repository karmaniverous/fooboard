/**
 * Tests for `GitHubHttpClient`: a conditional GET with the caller's ETag
 * (a 304 reports not-modified; the caller keeps the data), the budget
 * reported from every response's headers, token expiry, redirects, and
 * the typed errors (401, 403, rate limits, 404, 5xx, network, bad JSON).
 * Uses an injected fake `fetch`; no real network.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubValidationError,
  RateLimitedError,
} from './errors';
import { type FetchLike, GitHubHttpClient } from './httpClient';

/** Statuses the Fetch `Response` constructor forbids a body on. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const hasBody = body !== undefined && !NULL_BODY_STATUSES.has(status);
  return new Response(
    hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    { status, headers },
  );
}

const once =
  (res: Response | (() => Promise<Response>)): FetchLike =>
  () =>
    typeof res === 'function' ? res() : Promise.resolve(res);

const URL = 'https://api.github.com/x';

describe('GitHubHttpClient', () => {
  it('sends If-None-Match only when given an ETag', async () => {
    const seen: Record<string, string>[] = [];
    const fetchImpl: FetchLike = (_url, init) => {
      seen.push(init.headers);
      return Promise.resolve(response(200, { a: 1 }, { etag: '"e1"' }));
    };
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    const first = await client.get(URL);
    await client.get(URL, '"e1"');
    expect(first).toMatchObject({
      notModified: false,
      data: { a: 1 },
      etag: '"e1"',
    });
    expect(seen[0]?.['If-None-Match']).toBeUndefined();
    expect(seen[1]?.['If-None-Match']).toBe('"e1"');
    expect(seen[0]?.Authorization).toBe('Bearer t');
  });

  it('reports a 304 as not modified', async () => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(response(304, undefined)),
    });
    expect(await client.get(URL, '"e1"')).toEqual({ notModified: true });
  });

  it('reports the budget from every response, errors included', async () => {
    const onBudget = vi.fn();
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '123',
      'x-ratelimit-used': '1',
    };
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(response(404, {}, headers)),
      onBudget,
    });
    await expect(client.get(URL)).rejects.toBeInstanceOf(GitHubNotFoundError);
    expect(onBudget).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5000, remaining: 4999, used: 1 }),
    );
  });

  it('reports no budget when the headers are missing', async () => {
    const onBudget = vi.fn();
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(response(200, {})),
      onBudget,
    });
    await client.get(URL);
    expect(onBudget).not.toHaveBeenCalled();
  });

  it('tracks the token expiry header', async () => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(
        response(
          200,
          {},
          {
            'github-authentication-token-expiration': '2026-12-01 00:00:00 UTC',
          },
        ),
      ),
    });
    expect(client.getTokenExpiration()).toBeUndefined();
    await client.get(URL);
    expect(client.getTokenExpiration()).toBe('2026-12-01 00:00:00 UTC');
  });

  it('returns the Link header and whether fetch followed a redirect', async () => {
    const res = response(200, [], { link: '<https://x?page=2>; rel="next"' });
    Object.defineProperty(res, 'redirected', { value: true });
    const client = new GitHubHttpClient({ token: 't', fetchImpl: once(res) });
    expect(await client.get(URL)).toMatchObject({
      link: '<https://x?page=2>; rel="next"',
      redirected: true,
    });
  });

  it.each([
    [401, {}, {}, GitHubAuthError],
    [404, {}, {}, GitHubNotFoundError],
    [403, { message: 'Resource not accessible' }, {}, GitHubForbiddenError],
    [
      403,
      {},
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '9' },
      RateLimitedError,
    ],
    [
      403,
      { message: 'You have exceeded a secondary rate limit' },
      {},
      RateLimitedError,
    ],
    [429, {}, { 'retry-after': '30' }, RateLimitedError],
    [502, {}, {}, GitHubHttpError],
  ] as const)('maps %d to its error', async (status, body, headers, type) => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(response(status, body, headers)),
    });
    await expect(client.get(URL)).rejects.toBeInstanceOf(type);
  });

  it('gives a rate limit its retry time', async () => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(
        response(
          403,
          {},
          {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1000',
          },
        ),
      ),
    });
    await expect(client.get(URL)).rejects.toMatchObject({
      retryAt: 1_000_000,
    });
  });

  it('maps a failed fetch or body read to a network error', async () => {
    const failing = new GitHubHttpClient({
      token: 't',
      fetchImpl: () => Promise.reject(new TypeError('offline')),
    });
    await expect(failing.get(URL)).rejects.toBeInstanceOf(GitHubNetworkError);
    const res = response(200, {});
    Object.defineProperty(res, 'text', {
      value: () => Promise.reject(new Error('reset')),
    });
    const unreadable = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(res),
    });
    await expect(unreadable.get(URL)).rejects.toBeInstanceOf(
      GitHubNetworkError,
    );
  });

  it('maps a body that is not JSON to a validation error', async () => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: once(response(200, '<html>')),
    });
    await expect(client.get(URL)).rejects.toBeInstanceOf(GitHubValidationError);
  });

  it('never puts the token in an error message', async () => {
    const client = new GitHubHttpClient({
      token: 'ghp_secret',
      fetchImpl: once(response(401, {})),
    });
    await expect(client.get(URL)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Error && !err.message.includes('ghp_secret'),
    );
  });
});
