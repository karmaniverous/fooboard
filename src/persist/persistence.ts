/**
 * The persisted query cache (spec.md §3.4, Decisions 8, 27 and 28):
 * TanStack's persister writes the app's QueryClient to IndexedDB at most
 * once a second, and every tab restores it on load, so a reload shows the
 * last known board at once. Only successful queries that `keeps` accepts
 * are written (the app keeps none of an editor lookup's, nor any of a
 * credential whose secret isn't remembered); a restored copy is filtered
 * the same way, so nothing the rule excludes shows from the cache even if
 * an older copy holds it. A copy older than `CACHE_MAX_AGE_MS`, or written
 * under another buster (app version and data model version), is
 * discarded. Only the tab holding the persisting lock writes.
 *
 * @module
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient, QueryKey } from '@tanstack/query-core';
import {
  type PersistedClient,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';

import type { CacheStorage } from './cacheStorage';
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
  keeps: (queryKey: QueryKey) => boolean;
  locks: Locks | undefined;
}

export interface CachePersistence {
  /** Settles once the cache is restored (or found missing, stale or
   * unreadable); boards wait for it. */
  restored: Promise<void>;
  /** Stop persisting and let another tab take over. */
  stop(): void;
}

/** Restore `client` from storage, then persist it while this tab holds
 * the persisting lock. */
export function persistQueryCache({
  client,
  storage,
  buster,
  keeps,
  locks,
}: PersistOptions): CachePersistence {
  const base = createAsyncStoragePersister({
    storage,
    key: CACHE_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
  });
  const persister = {
    persistClient: (client: PersistedClient) => base.persistClient(client),
    removeClient: () => base.removeClient(),
    restoreClient: async () => {
      const stored = await base.restoreClient();
      if (!stored) return undefined;
      const { clientState } = stored;
      return {
        ...stored,
        clientState: {
          ...clientState,
          queries: clientState.queries.filter((q) => keeps(q.queryKey)),
        },
      };
    },
  };
  const shouldDehydrateQuery = (query: Query): boolean =>
    query.state.status === 'success' && keeps(query.queryKey);

  let stopped = false;
  let unsubscribe = (): void => undefined;
  let release = (): void => undefined;
  const restored = persistQueryClientRestore({
    queryClient: client,
    persister,
    maxAge: CACHE_MAX_AGE_MS,
    buster,
  })
    // An unreadable copy is discarded by the restore; start empty.
    .catch(() => undefined)
    .then(() => {
      if (stopped) return;
      release = holdPersistLock(locks, () => {
        unsubscribe = persistQueryClientSubscribe({
          queryClient: client,
          persister,
          buster,
          dehydrateOptions: { shouldDehydrateQuery },
        });
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
