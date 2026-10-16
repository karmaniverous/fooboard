/**
 * The key-value port the stores persist through (spec.md C-1): browser
 * local storage in the app, an in-memory map in tests and for session-only
 * secrets. Every key fooboard writes starts with `fooboard:`, so *Reset*
 * (C-4) can clear exactly the app's data and nothing else on the origin.
 *
 * @module
 */

/** Minimal synchronous storage, a subset of the Web Storage API. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Keys currently stored. */
  keys(): string[];
}

/** Prefix of every key fooboard writes. */
export const KEY_PREFIX = 'fooboard:';

/** Wrap a Web Storage object (e.g. `localStorage`). */
export function webStorage(storage: Storage): KeyValueStore {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      storage.setItem(key, value);
    },
    removeItem: (key) => {
      storage.removeItem(key);
    },
    keys: () =>
      Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (k): k is string => k !== null,
      ),
  };
}

/** An in-memory store: session-only data, and tests. */
export function memoryStorage(): KeyValueStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    keys: () => [...items.keys()],
  };
}

/** Read and parse a JSON value; `undefined` when absent or not JSON. */
export function readJson(store: KeyValueStore, key: string): unknown {
  const text = store.getItem(key);
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Remove every fooboard key (spec.md C-4 *Reset*). */
export function clearAppData(store: KeyValueStore): void {
  for (const key of store.keys()) {
    if (key.startsWith(KEY_PREFIX)) store.removeItem(key);
  }
}
