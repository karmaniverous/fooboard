/**
 * The board's query observers (spec.md §3.1): exactly one per query its
 * rows need, polling at the fastest cadence any of those rows asks for.
 * A need whose version changed invalidates its query once (a run that
 * completed refetches its jobs one last time; a compare refetches on a
 * new commit). Versions are kept per QueryClient, so they outlive a
 * board and a later board doesn't mistake a cached query for new. A query
 * removed from the cache (its credential's data dropped, here or in
 * another tab) is observed afresh, so it is read again at once rather
 * than at its observer's next poll.
 *
 * @module
 */
import {
  hashKey,
  type QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from '@tanstack/query-core';

import { getOrCreate } from '@/lib/memo';
import { faster, type Freshness } from '@/query/intervals';

import type { Need } from './need';

/** Needs merged by query: the fastest cadence and the rows they feed. */
export interface MergedNeed extends Need {
  feeds: Set<string>;
}

/** Merge each row's needs by query hash. */
export function mergeNeeds(
  rows: Iterable<[rowId: string, needs: readonly Need[]]>,
): Map<string, MergedNeed> {
  const merged = new Map<string, MergedNeed>();
  for (const [rowId, needs] of rows)
    for (const need of needs) {
      const hash = hashKey(need.key);
      const known = merged.get(hash);
      if (known) {
        known.freshness = faster(known.freshness, need.freshness);
        known.feeds.add(rowId);
      } else merged.set(hash, { ...need, feeds: new Set([rowId]) });
    }
  return merged;
}

const versionsByClient = new WeakMap<QueryClient, Map<string, string>>();

interface Observed {
  observer: QueryObserver;
  freshness: Freshness;
  unsubscribe: () => void;
}

const sameFreshness = (a: Freshness, b: Freshness) =>
  a.refetchInterval === b.refetchInterval && a.staleTime === b.staleTime;

export interface ObserverSet {
  /** Observe exactly `needs`. */
  sync(needs: ReadonlyMap<string, MergedNeed>): void;
  /** How many queries are observed. */
  size(): number;
  destroy(): void;
}

export function createObserverSet(client: QueryClient): ObserverSet {
  const observed = new Map<string, Observed>();
  const seen = getOrCreate(
    versionsByClient,
    client,
    () => new Map<string, string>(),
  );
  return {
    sync(needs) {
      for (const [hash, need] of needs) {
        const options: QueryObserverOptions = {
          queryKey: need.key,
          ...need.freshness,
        };
        let known = observed.get(hash);
        if (
          known &&
          known.observer.getCurrentQuery() !== client.getQueryCache().get(hash)
        ) {
          known.unsubscribe();
          observed.delete(hash);
          known = undefined;
        }
        if (!known) {
          const observer = new QueryObserver(client, options);
          observed.set(hash, {
            observer,
            freshness: need.freshness,
            unsubscribe: observer.subscribe(() => undefined),
          });
        } else if (!sameFreshness(known.freshness, need.freshness)) {
          known.observer.setOptions(options);
          known.freshness = need.freshness;
        }
        if (need.version === undefined) continue;
        const before = seen.get(hash);
        seen.set(hash, need.version);
        if (before !== undefined && before !== need.version)
          void client.invalidateQueries({ queryKey: need.key, exact: true });
      }
      for (const [hash, { unsubscribe }] of observed)
        if (!needs.has(hash)) {
          unsubscribe();
          observed.delete(hash);
        }
    },
    size: () => observed.size,
    destroy() {
      for (const { unsubscribe } of observed.values()) unsubscribe();
      observed.clear();
    },
  };
}
