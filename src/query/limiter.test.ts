/**
 * Tests for one credential's limiter (spec.md §3.1–3.2, Decisions 7, 29
 * and 45): at most `max` in flight, FIFO within two priorities with high
 * ahead of normal, a new cap applied at once, and a pause-until that
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

  it('runs at most max at once, high before normal, FIFO within each', async () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1 });
    const a = gate(started, 'a');
    const jobs1 = gate(started, 'jobs1');
    const jobs2 = gate(started, 'jobs2');
    const runs = gate(started, 'runs');
    const results = Promise.all([
      limiter.run('high', a.task),
      limiter.run('normal', jobs1.task),
      limiter.run('normal', jobs2.task),
      limiter.run('high', runs.task),
    ]);
    expect(started).toEqual(['a']);
    expect(limiter.stats()).toMatchObject({ running: 1, queued: 3 });
    a.open();
    await vi.advanceTimersByTimeAsync(0);
    runs.open();
    await vi.advanceTimersByTimeAsync(0);
    jobs1.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual(['a', 'runs', 'jobs1', 'jobs2']);
    jobs2.open();
    await expect(results).resolves.toEqual(['a', 'jobs1', 'jobs2', 'runs']);
  });

  it('settles as its task does, freeing the slot either way', async () => {
    const limiter = createLimiter({ max: 2 });
    await expect(limiter.run('high', () => Promise.resolve(7))).resolves.toBe(
      7,
    );
    await expect(
      limiter.run('high', () => Promise.reject(new Error('no'))),
    ).rejects.toThrow('no');
    expect(limiter.stats().running).toBe(0);
  });

  it('starts queued requests at once when the cap rises', async () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1 });
    const gates = ['a', 'b', 'c'].map((name) => gate(started, name));
    const results = Promise.all(gates.map((g) => limiter.run('high', g.task)));
    expect(started).toEqual(['a']);
    limiter.setMax(3);
    expect(started).toEqual(['a', 'b', 'c']);
    for (const g of gates) g.open();
    await expect(results).resolves.toEqual(['a', 'b', 'c']);
  });

  it('starts nothing during a pause, then resumes; a later pause wins', async () => {
    let now = 1_000;
    const started: string[] = [];
    const limiter = createLimiter({ max: 5, now: () => now });
    limiter.pauseUntil(3_000);
    limiter.pauseUntil(2_000);
    expect(limiter.stats().pausedUntil).toBe(3_000);
    const a = gate(started, 'a');
    const result = limiter.run('high', a.task);
    expect(started).toEqual([]);
    now = 3_000;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(started).toEqual(['a']);
    a.open();
    await expect(result).resolves.toBe('a');
  });

  it('lets running requests finish through a pause', async () => {
    const started: string[] = [];
    const limiter = createLimiter({ max: 1, now: () => 0 });
    const a = gate(started, 'a');
    const result = limiter.run('high', a.task);
    limiter.pauseUntil(10);
    a.open();
    await expect(result).resolves.toBe('a');
  });
});
