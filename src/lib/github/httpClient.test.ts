/**
 * Tests for `GitHubHttpClient`: ETag conditional requests (200 then 304
 * returns the cached body), rate-limit/token-expiry header tracking,
 * `Retry-After` pausing the queue, and 401/403/404 error mapping. Uses an
 * injected fake `fetch`; no real network.
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

/** Statuses the Fetch `Response` constructor forbids a body on (RFC 9110
 * §6.4.1: 304, plus the informational/no-content statuses). */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const hasBody = body !== undefined && !NULL_BODY_STATUSES.has(status);
  return new Response(hasBody ? JSON.stringify(body) : null, {
    status,
    headers,
  });
}

describe('GitHubHttpClient', () => {
  it('sends If-None-Match and returns the cached body on a 304', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers });
      if (calls.length === 1) {
        return Promise.resolve(
          jsonResponse(200, { hello: 'world' }, { etag: '"abc"' }),
        );
      }
      return Promise.resolve(jsonResponse(304, undefined));
    };
    const client = new GitHubHttpClient({ token: 't', fetchImpl });

    const first = await client.getJson('https://x/a');
    const second = await client.getJson('https://x/a');

    expect(first.data).toEqual({ hello: 'world' });
    expect(second.data).toEqual({ hello: 'world' });
    expect(calls[0].headers['If-None-Match']).toBeUndefined();
    expect(calls[1].headers['If-None-Match']).toBe('"abc"');
  });

  it('tracks rate-limit headers as the budget', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(
          200,
          {},
          {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': '123',
          },
        ),
      );
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    expect(client.getBudget()).toBeUndefined();
    await client.getJson('https://x/a');
    expect(client.getBudget()).toEqual({
      limit: 5000,
      remaining: 4999,
      reset: 123,
      used: 1,
      status: 'ok',
    });
  });

  it('tracks the token-expiration header', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(
          200,
          {},
          { 'github-authentication-token-expiration': '2026-12-01' },
        ),
      );
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    expect(client.getTokenExpiration()).toBeUndefined();
    await client.getJson('https://x/a');
    expect(client.getTokenExpiration()).toBe('2026-12-01');
  });

  it('maps 401 to GitHubAuthError', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(jsonResponse(401, { message: 'Bad credentials' }));
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it('maps 404 to GitHubNotFoundError', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(jsonResponse(404, { message: 'Not Found' }));
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubNotFoundError,
    );
  });

  it('maps a plain 403 (no rate-limit signal) to GitHubForbiddenError', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(
          403,
          { message: 'insufficient scope' },
          { 'x-ratelimit-remaining': '10' },
        ),
      );
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubForbiddenError,
    );
  });

  it('maps an exhausted 403 to RateLimitedError and pauses the queue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let calls = 0;
    const fetchImpl: FetchLike = () => {
      calls++;
      if (calls === 1) {
        return Promise.resolve(
          jsonResponse(
            403,
            { message: 'rate limited' },
            { 'retry-after': '30' },
          ),
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true }));
    };
    const client = new GitHubHttpClient({ token: 't', fetchImpl });

    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    const secondCall = client.getJson('https://x/b');
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await secondCall;

    expect(result.data).toEqual({ ok: true });
    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it('maps a network failure to GitHubNetworkError without leaking the token', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.reject(new TypeError('network down'));
    const client = new GitHubHttpClient({
      token: 'secret-token-value',
      fetchImpl,
    });
    await expect(client.getJson('https://x/a')).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(GitHubNetworkError);
        expect(err instanceof Error ? err.message : String(err)).not.toContain(
          'secret-token-value',
        );
        return true;
      },
    );
  });

  it('maps an unhandled status to GitHubHttpError', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(jsonResponse(500, { message: 'boom' }));
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubHttpError,
    );
  });

  it('never includes the token in the Authorization header beyond the bearer value sent, and never in errors', async () => {
    const seenHeaders: Record<string, string>[] = [];
    const fetchImpl: FetchLike = (_url, init) => {
      seenHeaders.push(init.headers);
      return Promise.resolve(jsonResponse(404, {}));
    };
    const client = new GitHubHttpClient({
      token: 'secret-token-value',
      fetchImpl,
    });
    const err = await client.getJson('https://x/a').catch((e: unknown) => e);
    expect(seenHeaders[0].Authorization).toBe('Bearer secret-token-value');
    expect(err instanceof Error ? err.message : String(err)).not.toContain(
      'secret-token-value',
    );
  });

  it('keeps the Link header when a 304 omits it', async () => {
    const link = '<https://x/a?page=2>; rel="next"';
    let n = 0;
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        n++ === 0
          ? jsonResponse(200, [1], { etag: '"e"', link })
          : jsonResponse(304, undefined),
      );
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    await client.getJson('https://x/a');
    const revalidated = await client.getJson('https://x/a');
    expect(revalidated.headers.get('link')).toBe(link);
  });

  it('treats a 403 secondary limit without headers as rate limited and pauses', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        jsonResponse(
          403,
          { message: 'You have exceeded a secondary rate limit.' },
          { 'x-ratelimit-remaining': '4000' },
        ),
      ),
    );
    const client = new GitHubHttpClient({ token: 't', fetchImpl });
    const before = Date.now();
    const err: unknown = await client
      .getJson('https://x/a')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    if (!(err instanceof RateLimitedError)) throw err;
    expect(err.retryAt).toBeGreaterThanOrEqual(before + 60_000);
  });

  it('makes a queued request wait after a headerless 429', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<FetchLike>(() =>
        Promise.resolve(jsonResponse(429, { message: 'slow down' })),
      );
      const client = new GitHubHttpClient({ token: 't', fetchImpl });
      await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
        RateLimitedError,
      );
      void client.getJson('https://x/b').catch(() => undefined);
      await vi.advanceTimersByTimeAsync(59_000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps a failed body read to a network error', async () => {
    const res = jsonResponse(200, {});
    vi.spyOn(res, 'text').mockRejectedValue(new Error('reset'));
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: () => Promise.resolve(res),
    });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubNetworkError,
    );
  });

  it('maps malformed JSON to a validation error', async () => {
    const client = new GitHubHttpClient({
      token: 't',
      fetchImpl: () => Promise.resolve(new Response('{oops', { status: 200 })),
    });
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(
      GitHubValidationError,
    );
  });
});
