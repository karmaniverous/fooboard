/**
 * One credential's request limiter (spec.md §3.1–3.2, Decisions 7, 29
 * and 45): at most `max` requests in flight, FIFO within two priorities
 * (high ahead of normal; `priorityOf` in `keys.ts` assigns them), and a
 * pause-until after a rate limit or throttle: no request starts before
 * the pause ends, while those already running finish. A new `max`
 * applies at once. Clock and timers are injected, so it is tested with
 * fake timers.
 *
 * @module
 */
import type { Priority } from './keys';

/** Timer functions, injectable. */
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface Limiter {
  /** Run `task` when a slot is free and the limiter isn't paused. */
  run<T>(priority: Priority, task: () => Promise<T>): Promise<T>;
  /** Change the cap; queued requests start up to it at once. */
  setMax(max: number): void;
  /** Start nothing new before `at` (unix ms); a later pause wins. */
  pauseUntil(at: number): void;
  /** Requests running and waiting, the cap and the pause (for tests and
   * Devtools-free inspection). */
  stats(): {
    running: number;
    queued: number;
    max: number;
    pausedUntil: number;
  };
}

interface Waiting {
  start: () => void;
}

export function createLimiter({
  max: initial,
  now = Date.now,
  timers = globalThis,
}: {
  max: number;
  now?: () => number;
  timers?: Timers;
}): Limiter {
  let max = initial;
  let running = 0;
  let pausedUntil = 0;
  let wake: unknown;
  const queues: Record<Priority, Waiting[]> = { high: [], normal: [] };

  const next = (): Waiting | undefined =>
    queues.high.shift() ?? queues.normal.shift();

  const pump = (): void => {
    const wait = pausedUntil - now();
    if (wait > 0) {
      if (wake === undefined)
        wake = timers.setTimeout(() => {
          wake = undefined;
          pump();
        }, wait);
      return;
    }
    while (running < max) {
      const waiting = next();
      if (!waiting) return;
      running += 1;
      waiting.start();
    }
  };

  return {
    run: (priority, task) =>
      new Promise((resolve, reject) => {
        queues[priority].push({
          start: () => {
            void task()
              .then(resolve, reject)
              .finally(() => {
                running -= 1;
                pump();
              });
          },
        });
        pump();
      }),
    setMax(value) {
      max = value;
      pump();
    },
    pauseUntil(at) {
      if (at <= pausedUntil) return;
      pausedUntil = at;
      if (wake !== undefined) timers.clearTimeout(wake);
      wake = undefined;
      pump();
    },
    stats: () => ({
      running,
      queued: queues.high.length + queues.normal.length,
      max,
      pausedUntil,
    }),
  };
}
