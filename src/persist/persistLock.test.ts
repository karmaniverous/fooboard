/**
 * Tests for the persisting lock (spec.md §3.4, §3.9, Decision 28): one tab
 * holds it, the next waiting tab takes it when the holder lets go or stops
 * writing, a request withdrawn before it is granted never runs, a refused
 * request is reported, and without Web Locks no tab holds it. Reset's
 * clear runs holding it, after the writer, or at once when no tab can.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { fakeLocks } from '@/test/tabs';

import { holdPersistLock, type Locks, withPersistLock } from './persistLock';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const refusing: Locks = {
  request: () => Promise.reject(new Error('SecurityError')),
};

/** Options holding the lock with `onHeld`; refusals fail the test. */
const holding = (onHeld: () => void, until?: Promise<void>) => ({
  onHeld,
  until,
  onRefused: (error: unknown) => {
    throw error;
  },
});

describe('holdPersistLock', () => {
  it('lets one tab hold it, then hands it to the next', async () => {
    const locks = fakeLocks();
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = holdPersistLock(locks, holding(first));
    holdPersistLock(locks, holding(second));
    await tick();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    releaseFirst();
    await tick();
    expect(second).toHaveBeenCalledOnce();
    expect(locks.holders()).toBe(1);
  });

  it('lets go once `until` settles (the tab stopped writing)', async () => {
    const locks = fakeLocks();
    let stop = (): void => undefined;
    const until = new Promise<void>((resolve) => {
      stop = resolve;
    });
    holdPersistLock(locks, holding(vi.fn(), until));
    const second = vi.fn();
    holdPersistLock(locks, holding(second));
    await tick();
    expect(second).not.toHaveBeenCalled();
    stop();
    await tick();
    expect(second).toHaveBeenCalledOnce();
  });

  it('lets go at once of a lock granted after it was released', async () => {
    const locks = fakeLocks();
    const releaseFirst = holdPersistLock(
      locks,
      holding(() => undefined),
    );
    const withdrawn = vi.fn();
    holdPersistLock(locks, holding(withdrawn))();
    const third = vi.fn();
    holdPersistLock(locks, holding(third));
    releaseFirst();
    await tick();
    expect(withdrawn).not.toHaveBeenCalled();
    expect(third).toHaveBeenCalledOnce();
  });

  it('reports a refused request', async () => {
    const onHeld = vi.fn();
    const onRefused = vi.fn();
    holdPersistLock(refusing, { onHeld, onRefused });
    await tick();
    expect(onHeld).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledWith(new Error('SecurityError'));
  });

  it('holds nothing without Web Locks', () => {
    const held = vi.fn();
    holdPersistLock(undefined, holding(held))();
    expect(held).not.toHaveBeenCalled();
  });
});

describe('withPersistLock', () => {
  it('runs the task once the writing tab lets go, and holds the lock meanwhile', async () => {
    const locks = fakeLocks();
    const releaseWriter = holdPersistLock(locks, holding(vi.fn()));
    const task = vi.fn(() => Promise.resolve());
    const done = withPersistLock(locks, task);
    await tick();
    expect(task).not.toHaveBeenCalled();
    releaseWriter();
    await done;
    expect(task).toHaveBeenCalledOnce();
    expect(locks.holders()).toBe(0);
  });

  it.each([
    ['without Web Locks', undefined],
    ['when the request is refused', refusing],
  ])('runs the task at once %s', async (_, locks) => {
    const task = vi.fn(() => Promise.resolve());
    await withPersistLock(locks, task);
    expect(task).toHaveBeenCalledOnce();
  });

  it('rejects when the task does, without running it again', async () => {
    const task = vi.fn(() => Promise.reject(new Error('blocked')));
    await expect(withPersistLock(fakeLocks(), task)).rejects.toThrow('blocked');
    expect(task).toHaveBeenCalledOnce();
  });
});
