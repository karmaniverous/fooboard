/**
 * When a row's cached data is *refreshing* (spec.md §3.1, Decisions 46
 * and 47): a root query feeding it has been fetching (or waiting for the
 * network to fetch) for longer than `REFRESHING_DELAY_MS`, or its data is
 * older than that query's poll interval. A quicker fetch, such as most
 * polls, never marks it, so the dot doesn't flash; nor does data still
 * within its interval, such as a board reopened soon after it was read,
 * because nothing is reading it again yet. Pure.
 *
 * @module
 */
import { NEVER_UPDATED, type Snapshot } from '@/query/cache';
import type { Freshness } from '@/query/intervals';

/** How long a fetch runs before it marks its row refreshing (Decision
 * 47): long enough that a quick poll never flashes the dot. */
export const REFRESHING_DELAY_MS = 300;

/** What the rule reads of one query. */
export type Read = Pick<
  Snapshot<unknown>,
  'updatedAt' | 'fetching' | 'queryHash'
>;

/** When the rule is applied, and when each fetch under way started. */
export interface RefreshClock {
  /** When the row is derived (ms). */
  now: number;
  /** When the fetch under way for a query started (ms; `undefined`
   * when none is). */
  fetchStartedAt: (queryHash: string) => number | undefined;
}

/** Has a fetch started at `startedAt` run longer than the delay by
 * `now`? */
const fetchIsSlow = (startedAt: number | undefined, now: number): boolean =>
  startedAt !== undefined && now - startedAt > REFRESHING_DELAY_MS;

/** Is `read`'s data refreshing by `clock`, the query polling at
 * `freshness`? */
export function isRefreshing(
  read: Read,
  freshness: Freshness,
  clock: RefreshClock,
): boolean {
  if (read.updatedAt === NEVER_UPDATED) return false;
  if (
    read.fetching &&
    fetchIsSlow(clock.fetchStartedAt(read.queryHash), clock.now)
  )
    return true;
  const interval = freshness.refetchInterval;
  return interval !== false && clock.now - read.updatedAt > interval;
}

/** `cells` with every one marked refreshing when `refreshing`. */
export function markRefreshing<T extends object>(
  cells: Record<string, T>,
  refreshing: boolean,
): Record<string, T> {
  if (!refreshing) return cells;
  return Object.fromEntries(
    Object.entries(cells).map(([id, cell]) => [
      id,
      { ...cell, refreshing: true },
    ]),
  );
}
