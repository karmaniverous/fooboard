/**
 * Where the query cache is persisted (spec.md §3.4, Decision 27): an
 * IndexedDB database named `fooboard`, so Reset's sweep of fooboard's
 * storage covers it. The storage the persister writes through turns
 * persistence off for the tab at the first failure (a quota error, or
 * IndexedDB blocked or missing): from then on it reads nothing and writes
 * nothing, and it tells its subscribers, so the app shows the
 * blocked-storage banner. A failed write also tries to remove what was
 * stored before, so a removal the write carried can't be undone by an
 * older copy coming back on the next load. Reset stops it for good, so no
 * write lands after the cache is cleared.
 *
 * @module
 */
import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval';

/** The IndexedDB database holding the persisted cache. */
export const CACHE_DATABASE = 'fooboard';

/** Its object store. */
const CACHE_OBJECT_STORE = 'cache';

/** The asynchronous key-value calls the persister makes, plus *clear*. */
export interface CacheStore {
  getItem(key: string): Promise<string | null | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Remove every entry (Reset). */
  clear(): Promise<void>;
}

/** The persisted cache's storage as the app uses it. */
export interface CacheStorage extends CacheStore {
  /** Has storage failed in this tab (persistence is off)? */
  failed(): boolean;
  /** Hear when storage fails. */
  subscribe(listener: () => void): () => void;
  /** Write nothing more in this tab (Reset; the tab is about to reload). */
  stop(): void;
}

/** The IndexedDB store, opened on first use. */
export function idbCacheStore(): CacheStore {
  let store: UseStore | undefined;
  const opened = (): UseStore =>
    (store ??= createStore(CACHE_DATABASE, CACHE_OBJECT_STORE));
  return {
    getItem: (key) => get<string>(key, opened()),
    setItem: (key, value) => set(key, value, opened()),
    removeItem: (key) => del(key, opened()),
    clear: () => clear(opened()),
  };
}

/** An in-memory store: tests, and stores built over an in-memory device. */
export function memoryCacheStore(): CacheStore & {
  entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => Promise.resolve(entries.get(key)),
    setItem: (key, value) => {
      entries.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      entries.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      entries.clear();
      return Promise.resolve();
    },
  };
}

/** The app's cache storage over `raw`. */
export function cacheStorage(raw: CacheStore): CacheStorage {
  let failed = false;
  let stopped = false;
  const listeners = new Set<() => void>();
  const fail = (): void => {
    if (failed) return;
    failed = true;
    for (const listener of listeners) listener();
  };
  /** Run `op`; a failure turns persistence off. */
  const attempt = async <T>(op: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await op();
    } catch {
      fail();
      return undefined;
    }
  };
  return {
    failed: () => failed,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      stopped = true;
    },
    getItem: async (key) =>
      failed ? undefined : await attempt(() => raw.getItem(key)),
    async setItem(key, value) {
      if (failed || stopped) return;
      try {
        await raw.setItem(key, value);
      } catch {
        fail();
        // Don't leave an older copy behind a write that failed.
        await raw.removeItem(key).catch(() => undefined);
      }
    },
    async removeItem(key) {
      await attempt(() => raw.removeItem(key));
    },
    async clear() {
      await attempt(() => raw.clear());
    },
  };
}
