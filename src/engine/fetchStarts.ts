/**
 * When each query's fetch under way started (spec.md §3.1, Decision 47),
 * by the board model's clock, and a call once it has run longer than the
 * refreshing delay, so the rows it feeds re-derive and show the dot then.
 * A fetch already under way when tracking begins counts from then. Each
 * fetch's timer is cleared when it settles, when its query is removed and
 * on `destroy`.
 *
 * @module
 */
import type { FetchStatus, QueryCache } from '@tanstack/query-core';

import { REFRESHING_DELAY_MS } from './refreshing';

/** A fetch marks its row from the first ms past the delay (`isRefreshing`
 * asks for longer than the delay), so its timer fires then. */
const SLOW_AFTER_MS = REFRESHING_DELAY_MS + 1;

/** What tracking reads of a query. */
interface Tracked {
  queryHash: string;
  state: { fetchStatus: FetchStatus };
}

export interface FetchStarts {
  /** When the fetch under way for a query started (`undefined` when
   * none is). */
  startedAt: (queryHash: string) => number | undefined;
  destroy(): void;
}

export function createFetchStarts({
  cache,
  now,
  onSlow,
}: {
  cache: QueryCache;
  now: () => number;
  /** A fetch still under way has just run longer than the delay. */
  onSlow: (queryHash: string) => void;
}): FetchStarts {
  const starts = new Map<
    string,
    { at: number; timer: ReturnType<typeof setTimeout> }
  >();

  const stop = (queryHash: string) => {
    const start = starts.get(queryHash);
    if (!start) return;
    clearTimeout(start.timer);
    starts.delete(queryHash);
  };

  const track = (query: Tracked) => {
    const { queryHash } = query;
    if (query.state.fetchStatus === 'idle') stop(queryHash);
    else if (!starts.has(queryHash))
      starts.set(queryHash, {
        at: now(),
        timer: setTimeout(() => {
          onSlow(queryHash);
        }, SLOW_AFTER_MS),
      });
  };

  for (const query of cache.getAll()) track(query);
  const unsubscribe = cache.subscribe((event) => {
    if (event.type === 'updated') track(event.query);
    else if (event.type === 'removed') stop(event.query.queryHash);
  });

  return {
    startedAt: (queryHash) => starts.get(queryHash)?.at,
    destroy() {
      unsubscribe();
      for (const queryHash of [...starts.keys()]) stop(queryHash);
    },
  };
}
