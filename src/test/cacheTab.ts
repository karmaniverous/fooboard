/**
 * Persisted-cache test helpers: a tab's client persisting to a shared raw
 * store under a lock, a query landing in it read with a secret, and the
 * stored copy's keys.
 *
 * @module
 */
import { type Query, QueryClient, type QueryKey } from '@tanstack/query-core';

import type { memoryCacheStore } from '@/persist/cacheStorage';
import { type CacheStorage, cacheStorage } from '@/persist/cacheStorage';
import type { Keeps } from '@/persist/keeps';
import {
  type CachePersistence,
  persistQueryCache,
} from '@/persist/persistence';
import type { Locks } from '@/persist/persistLock';
import { createReadWith, type ReadWith } from '@/query/readWith';

import { storedKeys } from './persisted';

/** The buster the tabs write under unless given another. */
export const BUSTER = '1.0.0+5';

/** A raw store the tabs share, its entries readable. */
export type RawStore = ReturnType<typeof memoryCacheStore>;

/** Keeps every query but those whose key starts with `refused`. */
export const keepsAllBut =
  (refused: string): Keeps =>
  (key: QueryKey) =>
    key[0] !== refused;

/** A tab's client, its secrets' record and storage, persisting. */
export interface CacheTab extends CachePersistence {
  client: QueryClient;
  readWith: ReadWith;
  storage: CacheStorage;
}

/** A tab's client persisting to `raw` with `locks`. */
export function cacheTab(
  raw: RawStore,
  locks: Locks,
  {
    buster = BUSTER,
    keeps = keepsAllBut('skip'),
  }: { buster?: string; keeps?: Keeps } = {},
): CacheTab {
  const client = new QueryClient();
  const readWith = createReadWith();
  const storage = cacheStorage(raw);
  const persistence = persistQueryCache({
    client,
    storage,
    buster,
    keeps,
    readWith,
    locks,
  });
  return { client, readWith, storage, ...persistence };
}

/** The query `key` names in `t`'s client. */
export function queryOf(t: CacheTab, key: QueryKey): Query {
  const query = t.client.getQueryCache().find({ queryKey: key, exact: true });
  if (!query) throw new Error(`no query ${JSON.stringify(key)}`);
  return query;
}

/** `data` lands for `key` in `t`, read with the secret `readWith`. */
export function land(
  t: CacheTab,
  key: QueryKey,
  data: unknown,
  readWith: string,
): void {
  t.readWith.note(
    t.client.getQueryCache().build(t.client, { queryKey: key }),
    readWith,
  );
  t.client.setQueryData(key, data);
}

/** The first parts of the keys in the stored copy. */
export const storedHeads = (raw: RawStore): unknown[] =>
  storedKeys(raw.entries).map((key) => key[0]);
