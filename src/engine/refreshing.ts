/**
 * When a row's cached data is *refreshing* (spec.md §3.1, Decision 46):
 * a root query feeding it is fetching (or waiting for the network to
 * fetch), or its data is older than that query's poll interval. Data
 * still within its interval, such as a board reopened soon after it was
 * read, is not marked, because nothing is reading it again yet. Pure.
 *
 * @module
 */
import { NEVER_UPDATED, type Snapshot } from '@/query/cache';
import type { Freshness } from '@/query/intervals';

/** What the rule reads of one query. */
export type Read = Pick<Snapshot<unknown>, 'updatedAt' | 'fetching'>;

/** Is `read`'s data refreshing at `now`, the query polling at `freshness`? */
export function isRefreshing(
  read: Read,
  freshness: Freshness,
  now: number,
): boolean {
  if (read.updatedAt === NEVER_UPDATED) return false;
  if (read.fetching) return true;
  const interval = freshness.refetchInterval;
  return interval !== false && now - read.updatedAt > interval;
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
