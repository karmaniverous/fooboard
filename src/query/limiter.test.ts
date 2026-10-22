/**
 * Tests for one credential's limiter (spec.md §3.1–3.2, Decisions 7 and
 * 29): at most `max` in flight, FIFO within two priorities with root
 * ahead of dependent, a new cap applied at once, and a pause-until that
 * starts nothing new before it ends (a later pause wins) while running
 * requests finish.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLimiter } from './limiter';

/** A task that resolves when told to, recording when it started. */
function gate(started: string[], name: string) {
  let open: () => void = () => undefined;
  const done = new Promise<string>((resolve) => {
    open = () => {
      resolve(name);
    };
  });
  return {
    task: () => {
      started.push(name);
      return done;
    },
    open,
  };
}

describe('createLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at most max at once, root before dependent, FIFO within each', async () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1 });
    const a = gate(started, 'a');
    const jobs1 = gate(started, 'jobs1');
    const jobs2 = gate(started, 'jobs2');
    const runs = gate(started, 'runs');
    void limiter.run('root', a.task);
    void limiter.run('dependent', jobs1.task);
    void limiter.run('dependent', jobs2.task);
    void limiter.run('root', runs.task);
    expect(started).toEqual(['a']);
    expect(limiter.stats()).toMatchObject({ running: 1, queued: 3 });
    a.open();
    await vi.advanceTimersByTimeAsync(0);
    runs.open();
    await vi.advanceTimersByTimeAsync(0);
    jobs1.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual(['a', 'runs', 'jobs1', 'jobs2']);
  });

  it('settles as its task does, freeing the slot either way', async () => {
    const limiter = createLimiter({ max: 2 });
    await expect(limiter.run('root', () => Promise.resolve(7))).resolves.toBe(
      7,
    );
    await expect(
      limiter.run('root', () => Promise.reject(new Error('no'))),
    ).rejects.toThrow('no');
    expect(limiter.stats().running).toBe(0);
  });

  it('starts queued requests at once when the cap rises', () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1 });
    for (const name of ['a', 'b', 'c'])
      void limiter.run('root', gate(started, name).task);
    expect(started).toEqual(['a']);
    limiter.setMax(3);
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('starts nothing during a pause, then resumes; a later pause wins', async () => {
    let now = 1_000;
    const started: string[] = [];
    const limiter = createLimiter({ max: 5, now: () => now });
    limiter.pauseUntil(3_000);
    limiter.pauseUntil(2_000);
    expect(limiter.stats().pausedUntil).toBe(3_000);
    void limiter.run('root', gate(started, 'a').task);
    expect(started).toEqual([]);
    now = 3_000;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(started).toEqual(['a']);
  });

  it('lets running requests finish through a pause', async () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1, now: () => 0 });
    const a = gate(started, 'a');
    const result = limiter.run('root', a.task);
    limiter.pauseUntil(10);
    a.open();
    await expect(result).resolves.toBe('a');
  });
});
