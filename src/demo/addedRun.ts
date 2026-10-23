/**
 * The demo's added run (spec.md C-23, Decision 46 item 4): one cell gets
 * a newer run after the board has loaded, and that run's jobs take a few
 * seconds to answer, so the cell shows its last placement with the
 * refreshing dot until they land. Its row polls every 5 s (another of its
 * cells stays in progress), so the run shows within one poll. Pure data
 * and functions of elapsed time, plus the wait the provider answers after.
 *
 * @module
 */
import { type DemoJobState, MINUTE } from './scenarios';

/** The cell that gets the added run, `row:stage`. */
export const ADDED_RUN_CELL = { rowId: 'web-app', stageId: 'prod' } as const;

/** When the run appears, after demo start: once the other demo runs have
 * moved on (the last at 2 min, `jobStates`) and the board has loaded even
 * one request at a time (about 81 s at 300 ms latency). */
export const ADDED_RUN_AT_MS = 2.5 * MINUTE;

/** How long the run takes, from appearing to success. */
export const ADDED_RUN_DURATION_MS = MINUTE;

/** How long the run's jobs take to answer: the refreshing dot's time. */
export const ADDED_RUN_JOBS_DELAY_MS = 5_000;

/** Wait `ms` before answering. */
export type Wait = (ms: number) => Promise<void>;

/** The real wait. */
export const sleep: Wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Is the run there `elapsedMs` after demo start? */
export const addedRunShown = (elapsedMs: number): boolean =>
  elapsedMs >= ADDED_RUN_AT_MS;

/** The run's deploy and test job states, `elapsedMs` after demo start
 * (once it is shown). */
export function addedRunStates(elapsedMs: number): {
  deploy: DemoJobState;
  test: DemoJobState;
} {
  return elapsedMs < ADDED_RUN_AT_MS + ADDED_RUN_DURATION_MS
    ? { deploy: 'running', test: 'queued' }
    : { deploy: 'success', test: 'success' };
}
