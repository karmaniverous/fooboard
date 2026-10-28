/**
 * GitHub rate-limit budget tracking (spec.md C-16): parse
 * `X-RateLimit-Limit/Remaining/Reset/Used` from a response, report `'low'`
 * once remaining budget is at or under 10% of the limit for the battery, say when a token is past its polling
 * share (its rows then poll slower), and compute when to resume after a
 * `Retry-After` or primary-limit reset.
 *
 * @module
 */

import { secondsToMs } from '@/lib/retryAfter';

import { HTTP_STATUS } from './status';

/** Current rate-limit state for one credential. */
export interface RateLimitBudget {
  /** Requests allowed per rate-limit window. */
  limit: number;
  /** Requests left in the current window. */
  remaining: number;
  /** Unix seconds when the window resets. */
  reset: number;
  /** Requests used in the current window. */
  used: number;
  /** `'low'` once `remaining` is at or under 10% of `limit`. */
  status: 'ok' | 'low';
}

/** Fraction of `limit` at or under which the budget is reported `'low'`. */
const LOW_BUDGET_FRACTION = 0.1;

/** A budget from the rate-limit headers' numbers, flagged low at 10%
 * left. */
function budgetFrom({
  limit,
  remaining,
  reset,
  used,
}: Omit<RateLimitBudget, 'status'>): RateLimitBudget {
  const status: RateLimitBudget['status'] =
    remaining <= limit * LOW_BUDGET_FRACTION ? 'low' : 'ok';
  return { limit, remaining, reset, used, status };
}

/**
 * Parse rate-limit headers into a `RateLimitBudget`, or `undefined` if the
 * response carried none (e.g. a request that bypassed the API gateway).
 */
export function parseRateLimitHeaders(
  headers: Headers,
): RateLimitBudget | undefined {
  const limitHeader = headers.get('x-ratelimit-limit');
  const remainingHeader = headers.get('x-ratelimit-remaining');
  const resetHeader = headers.get('x-ratelimit-reset');
  if (limitHeader === null || remainingHeader === null || resetHeader === null)
    return undefined;

  const limit = Number(limitHeader);
  const remaining = Number(remainingHeader);
  const reset = Number(resetHeader);
  if (Number.isNaN(limit) || Number.isNaN(remaining) || Number.isNaN(reset))
    return undefined;

  const usedHeader = headers.get('x-ratelimit-used');
  const used = usedHeader === null ? limit - remaining : Number(usedHeader);
  return budgetFrom({ limit, remaining, reset, used });
}

/**
 * Compute the unix-ms timestamp to resume requests after a rate-limited
 * response: prefer `Retry-After` (seconds from now), fall back to
 * `X-RateLimit-Reset` (unix seconds), fall back to a minute from `now` if
 * neither header is present or parseable (negative or non-finite values
 * are ignored).
 */
export function computeRetryAt(headers: Headers, now = Date.now()): number {
  const retryAfter = secondsToMs(headers.get('retry-after'));
  if (retryAfter !== undefined) return now + retryAfter;
  const reset = secondsToMs(headers.get('x-ratelimit-reset'));
  if (reset !== undefined) return reset;
  // No hint: GitHub asks for at least a minute after a secondary limit.
  return now + FALLBACK_RETRY_MS;
}

/** Wait after a rate limit that carries no retry or reset header. */
const FALLBACK_RETRY_MS = 60_000;

/**
 * True when a response looks like a rate-limit response rather than a plain
 * 403 (insufficient scope): a `Retry-After` header, an exhausted primary
 * limit (`X-RateLimit-Remaining: 0`), or an HTTP 429.
 */
export function isRateLimitResponse(status: number, headers: Headers): boolean {
  if (status === HTTP_STATUS.tooManyRequests) return true;
  if (headers.get('retry-after') !== null) return true;
  return headers.get('x-ratelimit-remaining') === '0';
}

/** The share of a token's hourly budget its polling may use before it
 * backs off (spec.md C-16: half). */
const POLLING_SHARE = 0.5;

/** Has this credential used more than `POLLING_SHARE` of its hourly
 * budget? Polling backs off past this point so other tools keep headroom
 * (spec.md C-16). */
export function isOverPollingShare(
  budget: RateLimitBudget | undefined,
): boolean {
  return budget !== undefined && budget.used > budget.limit * POLLING_SHARE;
}
