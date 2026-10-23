/**
 * Tests for error classes and the retry policy (spec.md §3.1, §3.3):
 * only transient failures (network, 5xx, AWS server faults) retry, with
 * exponential delay and a bounded count; 4xx answers, rate limits and
 * throttles never retry (the limiter pauses instead).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  AmplifyThrottledError,
} from '@/lib/amplify/errors';
import {
  GitHubAuthError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  RateLimitedError,
} from '@/lib/github/errors';

import {
  isAuthFailure,
  isNotFound,
  isRateLimit,
  isTransient,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  retryDelay,
  shouldRetry,
} from './errors';

const serverFault = () =>
  Object.assign(new Error('InternalFailure'), { $fault: 'server' });
const clientFault = () =>
  Object.assign(new Error('BadRequestException'), { $fault: 'client' });

describe('query errors', () => {
  it.each([
    ['a network failure', new GitHubNetworkError('runs', new Error('x')), true],
    ['a fetch TypeError', new TypeError('Failed to fetch'), true],
    ['a GitHub 502', new GitHubHttpError('runs', 502), true],
    ['an AWS server fault', serverFault(), true],
    ['a GitHub 422', new GitHubHttpError('runs', 422), false],
    ['a 401', new GitHubAuthError('runs'), false],
    ['a 404', new GitHubNotFoundError('runs'), false],
    ['a rate limit', new RateLimitedError('runs', 0), false],
    ['an Amplify throttle', new AmplifyThrottledError('t', 'op', 5), false],
    ['an AWS client fault', clientFault(), false],
  ])('%s is transient: %s', (_label, err, transient) => {
    expect(isTransient(err)).toBe(transient);
    expect(shouldRetry(0, err)).toBe(transient);
  });

  it('stops retrying after MAX_RETRIES, waiting longer each time', () => {
    const err = new GitHubHttpError('runs', 503);
    expect(shouldRetry(MAX_RETRIES - 1, err)).toBe(true);
    expect(shouldRetry(MAX_RETRIES, err)).toBe(false);
    expect(retryDelay(0)).toBe(RETRY_BASE_DELAY_MS);
    expect(retryDelay(1)).toBe(RETRY_BASE_DELAY_MS * 2);
  });

  it('classes rate limits, auth failures and not-found across providers', () => {
    expect(isRateLimit(new RateLimitedError('runs', 0))).toBe(true);
    expect(isRateLimit(new AmplifyThrottledError('t', 'op', 5))).toBe(true);
    expect(isAuthFailure(new GitHubAuthError('runs'))).toBe(true);
    expect(isAuthFailure(new AmplifyAuthError('denied', 'op'))).toBe(true);
    expect(isNotFound(new GitHubNotFoundError('runs'))).toBe(true);
    expect(isNotFound(new AmplifyNotFoundError('gone', 'op'))).toBe(true);
    expect(isNotFound(new GitHubAuthError('runs'))).toBe(false);
  });
});
