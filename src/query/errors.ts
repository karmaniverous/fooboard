/**
 * How the query layer treats a failed request (spec.md §3.1, Decisions
 * 26 and 29): rate limits and throttles go to the limiter, never to
 * retry; 4xx answers (bad or missing credential, not found, forbidden)
 * are not retried; network errors and 5xx answers are retried up to
 * twice. The board shows 401 as *Needs credential* and 404 (or Amplify's
 * `NotFoundException`) as *Error: not found*, whatever is cached.
 *
 * @module
 */
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
import { HTTP_STATUS } from '@/lib/github/status';

/** Retries after the first attempt, for network errors and 5xx. */
export const MAX_RETRIES = 2;
/** The first retry's delay; each later one doubles it. */
export const RETRY_BASE_DELAY_MS = 1_000;

/** A provider's rate limit or throttle: the cached data stays. */
export const isRateLimit = (err: unknown): boolean =>
  err instanceof RateLimitedError || err instanceof AmplifyThrottledError;

/** The credential was rejected (401, or an AWS auth error). */
export const isAuthFailure = (err: unknown): boolean =>
  err instanceof GitHubAuthError || err instanceof AmplifyAuthError;

/** The repo or app is gone, or no longer visible to the credential. */
export const isNotFound = (err: unknown): boolean =>
  err instanceof GitHubNotFoundError || err instanceof AmplifyNotFoundError;

/** An AWS SDK error the server is to blame for (`$fault: 'server'`). */
const isAwsServerFault = (err: unknown): boolean =>
  err instanceof Error && Reflect.get(err, '$fault') === 'server';

/** Worth trying again: the network failed, or the server did. */
export function isTransient(err: unknown): boolean {
  if (err instanceof GitHubNetworkError) return true;
  if (err instanceof GitHubHttpError)
    return err.status >= HTTP_STATUS.serverError;
  // `fetch` rejects with a TypeError when the network fails.
  return err instanceof TypeError || isAwsServerFault(err);
}

/** TanStack's `retry`: up to `MAX_RETRIES`, transient failures only. */
export const shouldRetry = (failureCount: number, err: unknown): boolean =>
  failureCount < MAX_RETRIES && isTransient(err);

/** TanStack's `retryDelay`: doubling from `RETRY_BASE_DELAY_MS`. */
export const retryDelay = (attempt: number): number =>
  RETRY_BASE_DELAY_MS * 2 ** attempt;
