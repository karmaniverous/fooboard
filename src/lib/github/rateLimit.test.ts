/**
 * Tests for rate-limit header parsing, the low-budget threshold, retry-at
 * computation and rate-limit-response detection.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  computeRetryAt,
  isOverPollingShare,
  isRateLimitResponse,
  parseRateLimitHeaders,
} from './rateLimit';

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('parseRateLimitHeaders', () => {
  it('parses limit/remaining/reset/used', () => {
    const budget = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4990',
        'x-ratelimit-reset': '1760000000',
        'x-ratelimit-used': '10',
      }),
    );
    expect(budget).toEqual({
      limit: 5000,
      remaining: 4990,
      reset: 1760000000,
      used: 10,
      status: 'ok',
    });
  });

  it('derives used from limit - remaining when absent', () => {
    const budget = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4990',
        'x-ratelimit-reset': '1760000000',
      }),
    );
    expect(budget?.used).toBe(10);
  });

  it('reports status "low" at or under the default 10% threshold', () => {
    const budget = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '500',
        'x-ratelimit-reset': '1760000000',
      }),
    );
    expect(budget?.status).toBe('low');
  });

  it('returns undefined when headers are missing', () => {
    expect(parseRateLimitHeaders(headers({}))).toBeUndefined();
  });
});

describe('computeRetryAt', () => {
  const now = 1_000_000;

  it('prefers Retry-After, interpreted as seconds from now', () => {
    expect(computeRetryAt(headers({ 'retry-after': '30' }), now)).toBe(
      now + 30_000,
    );
  });

  it('falls back to X-RateLimit-Reset (unix seconds) when Retry-After is absent', () => {
    expect(
      computeRetryAt(headers({ 'x-ratelimit-reset': '1760000000' }), now),
    ).toBe(1760000000 * 1000);
  });

  it('falls back to now when neither header is present', () => {
    expect(computeRetryAt(headers({}), now)).toBe(now);
  });
});

describe('isRateLimitResponse', () => {
  it('is true for 429', () => {
    expect(isRateLimitResponse(429, headers({}))).toBe(true);
  });

  it('is true for 403 with Retry-After', () => {
    expect(isRateLimitResponse(403, headers({ 'retry-after': '5' }))).toBe(
      true,
    );
  });

  it('is true for 403 with exhausted primary limit', () => {
    expect(
      isRateLimitResponse(403, headers({ 'x-ratelimit-remaining': '0' })),
    ).toBe(true);
  });

  it('is false for a plain 403 (e.g. insufficient scope)', () => {
    expect(
      isRateLimitResponse(403, headers({ 'x-ratelimit-remaining': '10' })),
    ).toBe(false);
  });
});

describe('isOverPollingShare', () => {
  it.each([
    [2500, false],
    [2501, true],
  ])('used %i of 5000 => %s', (used, expected) => {
    expect(
      isOverPollingShare({
        limit: 5000,
        remaining: 5000 - used,
        reset: 0,
        used,
        status: 'ok',
      }),
    ).toBe(expected);
  });
});
