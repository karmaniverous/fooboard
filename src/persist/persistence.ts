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
 * A removal (a credential's queries dropped) is written at once by
 * `saveNow`, outside the throttle, through an unthrottled twin of the
 * same persister (same storage, key, wrapping and buster), so the removed
 * answers are gone from IndexedDB before a quick close (spec 0.2.0 §3.C,
 * #33). The throttled writer stays subscribed: a write it has queued runs
 * with the post-removal state the removal's own cache events gave it.
 *
 * @module
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { DehydratedState, Query, QueryClient } from '@tanstack/query-core';
import {
  type PersistedClient,
  type Persister,
  persistQueryClientRestore,
  persistQueryClientSave,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';

import type { ReadWith } from '@/query/readWith';

import type { CacheStorage } from './cacheStorage';
import type { Keeps } from './keeps';
import { holdPersistLock, type Locks } from './persistLock';

/** At most one write per second (TanStack's default throttle). */
export const PERSIST_THROTTLE_MS = 1000;

/** `saveNow`'s persister doesn't throttle: it writes on every call. */
const NO_THROTTLE_MS = 0;

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
  /** Write the cache now, outside the throttle (after a removal), if this
   * tab is the one persisting (a failed or stopped storage writes
   * nothing). */
  saveNow(): void;
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
  const cache = client.getQueryCache();
  const readWithOf = (hash: string): string | undefined => {
    const query = cache.get(hash);
    return query && readWith.of(query);
  };
  /** The queries the restore hydrated, to note their secrets after. */
  let kept: StoredQuery[] = [];
  /** The persister over `storage` writing at most once per
   * `throttleTime`: each stored query carries the fingerprint of the
   * secret it was read with, and a restored copy keeps only what `keeps`
   * accepts with those fingerprints. */
  const fingerprintedPersister = (throttleTime: number): Persister => {
    const base = createAsyncStoragePersister({
      storage,
      key: CACHE_KEY,
      throttleTime,
    });
    return {
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
  };
  const persister = fingerprintedPersister(PERSIST_THROTTLE_MS);
  const immediate = fingerprintedPersister(NO_THROTTLE_MS);
  const shouldDehydrateQuery = (query: Query): boolean =>
    query.state.status === 'success' &&
    keeps(query.queryKey, readWith.of(query));
  const dehydrateOptions = { shouldDehydrateQuery };

  let stopped = false;
  /** This tab holds the persisting lock and writes. */
  let held = false;
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
          held = true;
          unsubscribe = persistQueryClientSubscribe({
            queryClient: client,
            persister,
            buster,
            dehydrateOptions,
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
    saveNow() {
      if (!held) return;
      // As for the throttled writer, a failed or stopped storage writes
      // nothing, and a failed write fails the storage, which reports it.
      persistQueryClientSave({
        queryClient: client,
        persister: immediate,
        buster,
        dehydrateOptions,
      }).catch(() => undefined);
    },
    stop() {
      stopped = true;
      held = false;
      unsubscribe();
      release();
    },
  };
}
