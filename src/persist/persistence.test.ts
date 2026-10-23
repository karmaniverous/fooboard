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
import { QueryClient, type QueryKey } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storedKeys as keysIn } from '@/test/persisted';
import { fakeLocks } from '@/test/tabs';

import { cacheStorage, memoryCacheStore } from './cacheStorage';
import {
  CACHE_KEY,
  CACHE_MAX_AGE_MS,
  PERSIST_THROTTLE_MS,
  persistQueryCache,
} from './persistence';

const BUSTER = '1.0.0+5';
const keepsAllBut =
  (refused: string) =>
  (key: QueryKey): boolean =>
    key[0] !== refused;

/** A tab's client persisting to `raw` with `locks`. */
function tab(
  raw: ReturnType<typeof memoryCacheStore>,
  locks: ReturnType<typeof fakeLocks>,
  { buster = BUSTER, refused = 'skip' } = {},
) {
  const client = new QueryClient();
  const persistence = persistQueryCache({
    client,
    storage: cacheStorage(raw),
    buster,
    keeps: keepsAllBut(refused),
    locks,
  });
  return { client, ...persistence };
}

/** The first parts of the keys in the stored copy. */
const storedKeys = (raw: ReturnType<typeof memoryCacheStore>) =>
  keysIn(raw.entries).map((key) => key[0]);

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
    const { client, restored } = tab(raw, fakeLocks());
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
    expect(storedKeys(raw)).toEqual(['a']);
    const first = writes.mock.calls.length;
    client.setQueryData(['b'], 3);
    client.setQueryData(['c'], 4);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS - 1);
    expect(writes.mock.calls.length).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes.mock.calls.length).toBe(first + 1);
    expect(storedKeys(raw)).toEqual(['a', 'b', 'c']);
  });

  it('restores what was stored, with its times, minus what it no longer keeps', async () => {
    const raw = memoryCacheStore();
    const writer = tab(raw, fakeLocks());
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    writer.client.setQueryData(['a'], 1, { updatedAt: 1234 });
    writer.client.setQueryData(['b'], 2);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const reader = tab(raw, fakeLocks(), { refused: 'b' });
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
    const writer = tab(raw, fakeLocks());
    await writer.restored;
    await vi.advanceTimersByTimeAsync(0);
    writer.client.setQueryData(['a'], 1);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    writer.stop();
    vi.setSystemTime(Date.now() + age);

    const reader = tab(raw, fakeLocks(), options);
    await reader.restored;
    expect(reader.client.getQueryData(['a'])).toBeUndefined();
    expect(raw.entries.has(CACHE_KEY)).toBe(false);
  });

  it('discards an unreadable copy and starts empty', async () => {
    const raw = memoryCacheStore();
    raw.entries.set(CACHE_KEY, 'not json');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reader = tab(raw, fakeLocks());
    await reader.restored;
    expect(reader.client.getQueryCache().getAll()).toEqual([]);
    expect(raw.entries.has(CACHE_KEY)).toBe(false);
  });

  it('lets only the lock holder write, and the next tab take over when it stops', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const first = tab(raw, locks);
    const second = tab(raw, locks);
    await Promise.all([first.restored, second.restored]);
    await vi.advanceTimersByTimeAsync(0);
    first.client.setQueryData(['first'], 1);
    second.client.setQueryData(['second'], 2);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedKeys(raw)).toEqual(['first']);

    first.stop();
    await vi.advanceTimersByTimeAsync(0);
    second.client.setQueryData(['second'], 3);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedKeys(raw)).toEqual(['second']);
    // The tab that stopped writes no more.
    first.client.setQueryData(['late'], 4);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedKeys(raw)).toEqual(['second']);
  });

  it('never takes the lock once stopped before restoring', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const stopped = tab(raw, locks);
    stopped.stop();
    await stopped.restored;
    await vi.advanceTimersByTimeAsync(0);
    expect(locks.holders()).toBe(0);
  });
});
