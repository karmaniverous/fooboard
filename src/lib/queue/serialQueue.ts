/**
 * Per-credential serial request queue (spec.md §5, C-16): GitHub's
 * secondary-limit guidance, and simple politeness toward Amplify, both ask
 * for at most one in-flight request per credential, processed FIFO. Shared
 * between the GitHub and Amplify adapters (spec.md §8 step 5) so every
 * credential, of either kind, gets the same serialization and the same
 * "pause until" behaviour for a rate-limited or throttled response.
 *
 * @module
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes async tasks for one credential: one in flight at a time, FIFO. */
export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  private pausedUntil = 0;

  /** Delay the next queued task (not any task already running) until `timestampMs`. */
  pauseUntil(timestampMs: number): void {
    if (timestampMs > this.pausedUntil) this.pausedUntil = timestampMs;
  }

  /** The timestamp (unix ms) the queue is currently paused until, or `0`. */
  getPausedUntil(): number {
    return this.pausedUntil;
  }

  /** Run `task` after every previously enqueued task has settled. */
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const wait = this.pausedUntil - Date.now();
      if (wait > 0) await sleep(wait);
      return task();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
