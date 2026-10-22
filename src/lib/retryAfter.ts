/**
 * Retry hints in seconds, shared by the GitHub and Amplify adapters:
 * `Retry-After` (seconds from now) and GitHub's `X-RateLimit-Reset`
 * (unix seconds), read as milliseconds. Pure.
 *
 * @module
 */

/** Milliseconds per second. */
const MS_PER_SECOND = 1_000;

/** A header value giving a whole or fractional number of seconds, in
 * milliseconds; `undefined` when absent, negative or not a finite number. */
export function secondsToMs(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0
    ? seconds * MS_PER_SECOND
    : undefined;
}
