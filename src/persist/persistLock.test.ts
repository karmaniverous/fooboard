/**
 * Tests for the persisting lock (spec.md §3.4, Decision 28): one tab holds
 * it, the next waiting tab takes it when the holder lets go, a request
 * withdrawn before it is granted never runs, and without Web Locks no tab
 * holds it.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { fakeLocks } from '@/test/tabs';

import { holdPersistLock } from './persistLock';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('holdPersistLock', () => {
  it('lets one tab hold it, then hands it to the next', async () => {
    const locks = fakeLocks();
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = holdPersistLock(locks, first);
    holdPersistLock(locks, second);
    await tick();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    releaseFirst();
    await tick();
    expect(second).toHaveBeenCalledOnce();
    expect(locks.holders()).toBe(1);
  });

  it('lets go at once of a lock granted after it was released', async () => {
    const locks = fakeLocks();
    const releaseFirst = holdPersistLock(locks, () => undefined);
    const withdrawn = vi.fn();
    holdPersistLock(locks, withdrawn)();
    const third = vi.fn();
    holdPersistLock(locks, third);
    releaseFirst();
    await tick();
    expect(withdrawn).not.toHaveBeenCalled();
    expect(third).toHaveBeenCalledOnce();
  });

  it('holds nothing without Web Locks', () => {
    const held = vi.fn();
    holdPersistLock(undefined, held)();
    expect(held).not.toHaveBeenCalled();
  });
});
