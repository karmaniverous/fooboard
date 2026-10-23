/**
 * Tests for the persisted cache's storage (spec.md §3.4): IndexedDB in a
 * database named `fooboard`; the first failure (a quota error, IndexedDB
 * blocked or missing) turns persistence off for the tab, tells
 * subscribers once, and removes the older copy a failed write would leave;
 * after Reset's stop nothing more is written, while clearing still works.
 *
 * @module
 */
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CACHE_DATABASE,
  cacheStorage,
  type CacheStore,
  idbCacheStore,
  memoryCacheStore,
} from './cacheStorage';

const quota = () => new DOMException('full', 'QuotaExceededError');

describe('idbCacheStore', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps entries in the fooboard database until removed or cleared', async () => {
    const store = idbCacheStore();
    await store.setItem('a', '1');
    await store.setItem('b', '2');
    expect(await store.getItem('a')).toBe('1');
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual([
      CACHE_DATABASE,
    ]);
    await store.removeItem('a');
    expect(await store.getItem('a')).toBeUndefined();
    await store.clear();
    expect(await idbCacheStore().getItem('b')).toBeUndefined();
  });

  it('fails the storage where IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const storage = cacheStorage(idbCacheStore());
    expect(await storage.getItem('a')).toBeUndefined();
    expect(storage.failed()).toBe(true);
  });
});

describe('cacheStorage', () => {
  /** A memory store whose `op` fails from now on. */
  const failing = (op: keyof CacheStore) => {
    const raw = memoryCacheStore();
    const real = raw[op].bind(raw);
    let fail = false;
    const store = {
      ...raw,
      [op]: (...args: [string, string]) =>
        fail ? Promise.reject(quota()) : real(...args),
    };
    return {
      raw,
      store,
      fail: () => {
        fail = true;
      },
    };
  };

  it('turns persistence off at a failed write, telling subscribers once, and leaves no older copy', async () => {
    const { raw, store, fail } = failing('setItem');
    const storage = cacheStorage(store);
    const heard = vi.fn();
    storage.subscribe(heard);
    await storage.setItem('k', 'old');
    fail();
    await storage.setItem('k', 'new');
    expect(storage.failed()).toBe(true);
    expect(raw.entries.has('k')).toBe(false);
    raw.entries.set('k', 'stray');
    // Off for the tab: nothing read, nothing written, nothing more heard.
    expect(await storage.getItem('k')).toBeUndefined();
    await storage.setItem('k', 'again');
    expect(raw.entries.get('k')).toBe('stray');
    vi.spyOn(store, 'clear').mockRejectedValue(quota());
    await storage.clear();
    expect(heard).toHaveBeenCalledOnce();
  });

  it.each(['getItem', 'removeItem', 'clear'] as const)(
    'turns persistence off when %s fails',
    async (op) => {
      const { store, fail } = failing(op);
      const storage = cacheStorage(store);
      fail();
      await storage[op]('k');
      expect(storage.failed()).toBe(true);
    },
  );

  it('writes nothing once stopped, but still clears', async () => {
    const raw = memoryCacheStore();
    const storage = cacheStorage(raw);
    await storage.setItem('k', '1');
    storage.stop();
    await storage.setItem('k', '2');
    expect(raw.entries.get('k')).toBe('1');
    await storage.clear();
    expect(raw.entries.size).toBe(0);
    expect(storage.failed()).toBe(false);
  });

  it('stops telling a listener that unsubscribed', async () => {
    const { store, fail } = failing('setItem');
    const storage = cacheStorage(store);
    const heard = vi.fn();
    storage.subscribe(heard)();
    fail();
    await storage.setItem('k', 'v');
    expect(heard).not.toHaveBeenCalled();
  });
});
