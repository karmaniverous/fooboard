/**
 * The persisted query cache (spec.md §3.4, Decisions 8, 27 and 28):
 * TanStack's persister writes the app's QueryClient to IndexedDB at most
 * once a second, and every tab restores it on load, so a reload shows the
 * last known board at once. Only successful queries that `keeps` accepts
 * are written, each with the fingerprint of the secret its data was read
 * with (never the secret); a restored copy is filtered the same way, with
 * the stored fingerprints, so nothing the rule now excludes shows from
 * the cache even if an older copy holds it (a secret replaced just before
 * a reload, ahead of the next write). A copy older than
 * `CACHE_MAX_AGE_MS`, or written under another buster (app version and
 * data model version), is discarded. Only the tab holding the persisting
 * lock writes, until its storage stops (Reset); if the browser refuses
 * the lock, the storage reports it as a failure.
 *
 * @module
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { DehydratedState, Query, QueryClient } from '@tanstack/query-core';
import {
  type PersistedClient,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';

import type { ReadWith } from '@/query/readWith';

import type { CacheStorage } from './cacheStorage';
import type { Keeps } from './keeps';
import { holdPersistLock, type Locks } from './persistLock';

/** At most one write per second (TanStack's default throttle). */
export const PERSIST_THROTTLE_MS = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A persisted copy older than a day is discarded (Q3). */
export const CACHE_MAX_AGE_MS = DAY_MS;

/** How long an unobserved query is kept in memory: as long as the
 * persisted copy (TanStack's default of 5 minutes would drop restored
 * queries before a board observes them). */
export const CACHE_GC_TIME_MS = DAY_MS;

/** The key the cache is stored under. */
export const CACHE_KEY = 'queries';

export interface PersistOptions {
  client: QueryClient;
  storage: CacheStorage;
  /** Discards a copy written under another value. */
  buster: string;
  /** May this query be kept at rest? */
  keeps: Keeps;
  /** The secret each query's data was read with. */
  readWith: ReadWith;
  locks: Locks | undefined;
}

export interface CachePersistence {
  /** Settles once the cache is restored (or found missing, stale or
   * unreadable); boards wait for it. */
  restored: Promise<void>;
  /** Stop persisting and let another tab take over. */
  stop(): void;
}

type StoredQuery = DehydratedState['queries'][number];

/** The fingerprint stored with a persisted query, if it has one. */
const storedReadWith = (query: StoredQuery): string | undefined =>
  'readWith' in query && typeof query.readWith === 'string'
    ? query.readWith
    : undefined;

/** Restore `client` from storage, then persist it while this tab holds
 * the persisting lock. */
export function persistQueryCache({
  client,
  storage,
  buster,
  keeps,
  readWith,
  locks,
}: PersistOptions): CachePersistence {
  const base = createAsyncStoragePersister({
    storage,
    key: CACHE_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
  });
  const cache = client.getQueryCache();
  const readWithOf = (hash: string): string | undefined => {
    const query = cache.get(hash);
    return query && readWith.of(query);
  };
  /** The queries the restore hydrated, to note their secrets after. */
  let kept: StoredQuery[] = [];
  const persister = {
    persistClient: ({ clientState, ...rest }: PersistedClient) =>
      base.persistClient({
        ...rest,
        clientState: {
          ...clientState,
          queries: clientState.queries.map((q) => ({
            ...q,
            readWith: readWithOf(q.queryHash),
          })),
        },
      }),
    removeClient: () => base.removeClient(),
    restoreClient: async () => {
      const stored = await base.restoreClient();
      if (!stored) return undefined;
      const { clientState } = stored;
      kept = clientState.queries.filter((q) =>
        keeps(q.queryKey, storedReadWith(q)),
      );
      return { ...stored, clientState: { ...clientState, queries: kept } };
    },
  };
  const shouldDehydrateQuery = (query: Query): boolean =>
    query.state.status === 'success' &&
    keeps(query.queryKey, readWith.of(query));

  let stopped = false;
  let unsubscribe = (): void => undefined;
  let release = (): void => undefined;
  const restored = persistQueryClientRestore({
    queryClient: client,
    persister,
    maxAge: CACHE_MAX_AGE_MS,
    buster,
  })
    .then(() => {
      for (const q of kept) {
        const query = cache.get(q.queryHash);
        const fingerprint = storedReadWith(q);
        // A query already read in this tab keeps its own secret.
        if (query && fingerprint && !readWith.of(query))
          readWith.note(query, fingerprint);
      }
    })
    // An unreadable copy is discarded by the restore; start empty.
    .catch(() => undefined)
    .then(() => {
      if (stopped) return;
      release = holdPersistLock(locks, {
        onHeld: () => {
          unsubscribe = persistQueryClientSubscribe({
            queryClient: client,
            persister,
            buster,
            dehydrateOptions: { shouldDehydrateQuery },
          });
        },
        until: storage.stopped,
        onRefused: () => {
          storage.fail();
        },
      });
    });
  return {
    restored,
    stop() {
      stopped = true;
      unsubscribe();
      release();
    },
  };
}
