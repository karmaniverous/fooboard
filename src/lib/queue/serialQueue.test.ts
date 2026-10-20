/**
 * Tests for `SerialQueue`: tasks run one at a time, in FIFO order, and
 * `pauseUntil` delays the next queued task (not one already running).
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { SerialQueue } from './serialQueue';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SerialQueue', () => {
  it('runs tasks serially: no two overlap', async () => {
    const queue = new SerialQueue();
    let inFlight = 0;
    let maxInFlight = 0;

    const makeTask = (ms: number) => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(ms);
      inFlight--;
      return ms;
    };

    const results = await Promise.all([
      queue.enqueue(makeTask(20)),
      queue.enqueue(makeTask(5)),
      queue.enqueue(makeTask(10)),
    ]);

    expect(maxInFlight).toBe(1);
    expect(results).toEqual([20, 5, 10]);
  });

  it('preserves FIFO order', async () => {
    const queue = new SerialQueue();
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        queue.enqueue(() => {
          order.push(n);
          return Promise.resolve();
        }),
      ),
    );

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('continues after a task rejects', async () => {
    const queue = new SerialQueue();
    const first = queue.enqueue(() => Promise.reject(new Error('boom')));
    const second = queue.enqueue(() => Promise.resolve('ok'));

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ok');
  });

  it('pauseUntil delays the next task, not the current one', async () => {
    vi.useFakeTimers();
    const queue = new SerialQueue();
    const timestamps: number[] = [];
    const now = 0;
    vi.setSystemTime(now);

    const first = queue.enqueue(() => {
      timestamps.push(Date.now());
      return Promise.resolve();
    });
    await first;

    queue.pauseUntil(1_000);
    const second = queue.enqueue(() => {
      timestamps.push(Date.now());
      return Promise.resolve();
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await second;

    expect(timestamps).toEqual([0, 1_000]);
    vi.useRealTimers();
  });
});
