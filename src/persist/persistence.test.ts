/**
 * Tests for the persisted query cache (spec.md §3.4, Decisions 8, 27 and
 * 28): the tab holding the lock writes successful queries that `keeps`
 * accepts, at most once a second; a new tab restores them with their
 * times, minus anything `keeps` now refuses; a copy from another buster,
 * older than a day or unreadable is discarded; only one tab writes, and
 * another takes over when it stops.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cacheTab,
  keepsAllBut,
  land,
  queryOf,
  storedHeads,
} from '@/test/cacheTab';
import { fakeLocks } from '@/test/tabs';

import { memoryCacheStore } from './cacheStorage';
import type { Keeps } from './keeps';
import {
  CACHE_KEY,
  CACHE_MAX_AGE_MS,
  PERSIST_THROTTLE_MS,
} from './persistence';
import type { Locks } from './persistLock';

describe('persistQueryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the successful queries it keeps, at most once a second', async () => {
    const raw = memoryCacheStore();
    const writes = vi.spyOn(raw, 'setItem');
    const { client, restored } = cacheTab(raw, fakeLocks());
    await restored;
    await vi.advanceTimersByTimeAsync(0);
    client.setQueryData(['a'], 1);
    client.setQueryData(['skip'], 2);
    await client
      .query({
        queryKey: ['failed'],
        queryFn: () => Promise.reject(new Error('no')),
        retry: false,
      })
      .catch(() => undefined);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['a']);
    const first = writes.mock.calls.length;
    client.setQueryData(['b'], 3);
    client.setQueryData(['c'], 4);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS - 1);
    expect(writes.mock.calls.length).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes.mock.calls.length).toBe(first + 1);
    expect(storedHeads(raw)).toEqual(['a', 'b', 'c']);
  });

  it('restores what was stored, with its times, minus what it no longer keeps', async () => {
    const raw = memoryCacheStore();
    const writer = cacheTab(raw, fakeLocks());
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    writer.client.setQueryData(['a'], 1, { updatedAt: 1234 });
    writer.client.setQueryData(['b'], 2);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const reader = cacheTab(raw, fakeLocks(), { keeps: keepsAllBut('b') });
    await reader.restored;
    expect(reader.client.getQueryData(['a'])).toBe(1);
    expect(reader.client.getQueryState(['a'])?.dataUpdatedAt).toBe(1234);
    expect(reader.client.getQueryData(['b'])).toBeUndefined();
  });

  it.each([
    ['written under another buster', { buster: '1.0.1+5' }, 0],
    ['older than a day', {}, CACHE_MAX_AGE_MS + 1],
  ])('discards a copy %s', async (_, options, age) => {
    const raw = memoryCacheStore();
    const writer = cacheTab(raw, fakeLocks());
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    writer.client.setQueryData(['a'], 1);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    writer.stop();
    vi.setSystemTime(Date.now() + age);

    const reader = cacheTab(raw, fakeLocks(), options);
    await reader.restored;
    expect(reader.client.getQueryData(['a'])).toBeUndefined();
    expect(raw.entries.has(CACHE_KEY)).toBe(false);
  });

  it('discards an unreadable copy and starts empty', async () => {
    const raw = memoryCacheStore();
    raw.entries.set(CACHE_KEY, 'not json');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reader = cacheTab(raw, fakeLocks());
    await reader.restored;
    expect(reader.client.getQueryCache().getAll()).toEqual([]);
    expect(raw.entries.has(CACHE_KEY)).toBe(false);
  });

  it('lets only the lock holder write, and the next tab take over when it stops', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const first = cacheTab(raw, locks);
    const second = cacheTab(raw, locks);
    await Promise.all([first.restored, second.restored]);
    await vi.advanceTimersByTimeAsync(0);
    first.client.setQueryData(['first'], 1);
    second.client.setQueryData(['second'], 2);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['first']);

    first.stop();
    await vi.advanceTimersByTimeAsync(0);
    second.client.setQueryData(['second'], 3);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['second']);
    // The tab that stopped writes no more.
    first.client.setQueryData(['late'], 4);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['second']);
  });

  it('stores the secret each query was read with, and restores only what its secret still keeps', async () => {
    const raw = memoryCacheStore();
    const remembered = new Map([['a', 'one']]);
    const keeps: Keeps = (key, readWith) =>
      readWith !== undefined && readWith === remembered.get(String(key[0]));
    const writer = cacheTab(raw, fakeLocks(), { keeps });
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    land(writer, ['a'], 1, 'one');
    land(writer, ['b'], 2, 'one');
    writer.client.setQueryData(['untold'], 3);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['a']);
    expect(raw.entries.get(CACHE_KEY)).toContain('"readWith":"one"');

    // Replaced before the next write: nothing read with the old secret.
    remembered.set('a', 'two');
    const reader = cacheTab(raw, fakeLocks(), { keeps });
    await reader.restored;
    expect(reader.client.getQueryData(['a'])).toBeUndefined();

    // Restored with the secret it was read with, so it is written again.
    remembered.set('a', 'one');
    const again = cacheTab(raw, fakeLocks(), { keeps });
    await again.restored;
    expect(again.client.getQueryData(['a'])).toBe(1);
    expect(again.readWith.of(queryOf(again, ['a']))).toBe('one');
  });

  it('keeps the secret of a query this tab read before the restore landed', async () => {
    const raw = memoryCacheStore();
    const keeps: Keeps = (_, readWith) => readWith === 'one';
    const writer = cacheTab(raw, fakeLocks(), { keeps });
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    land(writer, ['a'], 1, 'one');
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const reader = cacheTab(raw, fakeLocks(), { keeps });
    land(reader, ['a'], 2, 'session');
    await reader.restored;
    expect(reader.client.getQueryData(['a'])).toBe(2);
    expect(reader.readWith.of(queryOf(reader, ['a']))).toBe('session');
  });

  it('reports a refused lock, and still restores', async () => {
    const raw = memoryCacheStore();
    const writer = cacheTab(raw, fakeLocks());
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    writer.client.setQueryData(['a'], 1);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const refusing: Locks = {
      request: () => Promise.reject(new Error('SecurityError')),
    };
    const reader = cacheTab(raw, refusing);
    await reader.restored;
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.client.getQueryData(['a'])).toBe(1);
    expect(reader.storage.failed()).toBe(true);
  });

  it('lets the next tab write once its storage stops (Reset)', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const first = cacheTab(raw, locks);
    const second = cacheTab(raw, locks);
    await Promise.all([first.restored, second.restored]);
    await vi.advanceTimersByTimeAsync(0);
    first.storage.stop();
    await vi.advanceTimersByTimeAsync(0);
    first.client.setQueryData(['first'], 1);
    second.client.setQueryData(['second'], 2);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['second']);
  });

  it('never takes the lock once stopped before restoring', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const stopped = cacheTab(raw, locks);
    stopped.stop();
    await stopped.restored;
    await vi.advanceTimersByTimeAsync(0);
    expect(locks.holders()).toBe(0);
  });
});
