/**
 * Tests for writing the persisted cache at once after a removal (spec
 * 0.2.0 §3.C, #33): `saveNow` writes outside the throttle, so a close
 * straight after leaves nothing of the removed queries at rest; its copy
 * restores like the throttled writer's (same buster, each query's
 * fingerprint); other writes stay throttled; a throttled write queued
 * before the removal, or one in flight when it lands, leaves nothing
 * removed behind; and a tab that doesn't hold the persisting lock, or
 * whose storage has failed, writes nothing.
 *
 * @module
 */
import type { QueryKey } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cacheTab,
  land,
  queryOf,
  type RawStore,
  storedHeads,
} from '@/test/cacheTab';
import { fakeLocks } from '@/test/tabs';

import { memoryCacheStore } from './cacheStorage';
import type { Keeps } from './keeps';
import { CACHE_KEY, PERSIST_THROTTLE_MS } from './persistence';

/** Keeps what was read with the secret `one`. */
const keeps: Keeps = (_key: QueryKey, readWith) => readWith === 'one';

/** A persisting tab over `raw` (a fresh store unless given) holding `a`
 * and `b`, both written by the throttled writer. */
async function written(raw: RawStore = memoryCacheStore()) {
  const t = cacheTab(raw, fakeLocks(), { keeps });
  await t.restored;
  await vi.advanceTimersByTimeAsync(0);
  land(t, ['a'], 1, 'one');
  land(t, ['b'], 2, 'one');
  await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
  expect(storedHeads(raw)).toEqual(['a', 'b']);
  return { t, raw };
}

describe('saveNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a removal at once, so nothing removed is at rest after a quick close', async () => {
    const { t, raw } = await written();
    t.client.removeQueries({ queryKey: ['b'] });
    t.saveNow();
    // No time for the throttled writer: the tab closes now.
    await vi.advanceTimersByTimeAsync(0);
    expect(storedHeads(raw)).toEqual(['a']);
    expect(raw.entries.get(CACHE_KEY)).toContain('"readWith":"one"');
  });

  it('writes a copy the next tab restores, with each query’s fingerprint', async () => {
    const { t, raw } = await written();
    t.client.removeQueries({ queryKey: ['b'] });
    t.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    t.stop();

    const next = cacheTab(raw, fakeLocks(), { keeps });
    await next.restored;
    expect(next.client.getQueryData(['a'])).toBe(1);
    expect(next.client.getQueryData(['b'])).toBeUndefined();
    expect(next.readWith.of(queryOf(next, ['a']))).toBe('one');
  });

  it('leaves other writes throttled', async () => {
    const { t, raw } = await written();
    t.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    land(t, ['c'], 3, 'one');
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS - 1);
    expect(storedHeads(raw)).toEqual(['a', 'b']);
    await vi.advanceTimersByTimeAsync(1);
    expect(storedHeads(raw)).toEqual(['a', 'b', 'c']);
  });

  it('leaves nothing removed behind a throttled write queued before the removal', async () => {
    const { t, raw } = await written();
    // Queued: the throttled writer runs a second from now.
    land(t, ['c'], 3, 'one');
    t.client.removeQueries({ queryKey: ['b'] });
    t.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(storedHeads(raw)).toEqual(['a', 'c']);
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['a', 'c']);
  });

  it('leaves nothing removed behind a throttled write in flight when it lands', async () => {
    const raw = memoryCacheStore();
    const { t } = await written(raw);
    // The next write is applied in order, as IndexedDB's transactions
    // are, but lands only when let go.
    const setItem = raw.setItem.bind(raw);
    let land2 = (): void => undefined;
    vi.spyOn(raw, 'setItem').mockImplementationOnce(async (key, value) => {
      await setItem(key, value);
      await new Promise<void>((resolve) => {
        land2 = resolve;
      });
    });
    land(t, ['c'], 3, 'one');
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['a', 'b', 'c']);
    t.client.removeQueries({ queryKey: ['b'] });
    t.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    land2();
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(storedHeads(raw)).toEqual(['a', 'c']);
  });

  it('writes nothing from a tab without the persisting lock', async () => {
    const raw = memoryCacheStore();
    const locks = fakeLocks();
    const holder = cacheTab(raw, locks, { keeps });
    const other = cacheTab(raw, locks, { keeps });
    await Promise.all([holder.restored, other.restored]);
    await vi.advanceTimersByTimeAsync(0);
    const writes = vi.spyOn(raw, 'setItem');
    land(other, ['a'], 1, 'one');
    other.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).not.toHaveBeenCalled();
  });

  it('writes nothing once its storage has failed', async () => {
    const { t, raw } = await written();
    const writes = vi.spyOn(raw, 'setItem');
    t.storage.fail();
    t.client.removeQueries({ queryKey: ['b'] });
    t.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).not.toHaveBeenCalled();
  });
});
