/**
 * Timing instrumentation (spec.md §3.5, Decision 9), in development builds
 * only. In a production build `import.meta.env.DEV` is `false`, so these
 * exports are the pass-throughs below and the instrumentation modules are
 * dropped from the bundle (the build fails if any of it remains:
 * `vite/noDevInstrumentation.ts`). Tests use the pass-throughs too, and
 * test the instrumentation directly.
 *
 * @module
 */
import type { BoardModel } from '@/engine/types';
import { passThrough } from '@/query/instrument';

import { demoLatencyMs } from './demoLatency';
import { type StartTiming, useDevBoardTiming } from './useDevBoardTiming';

/** A development build outside tests. Module-local on purpose: the
 * production build folds it to `false` only within this module, so the
 * timing code drops out of the bundle. */
const ENABLED = import.meta.env.DEV && import.meta.env.MODE !== 'test';

const untimed: StartTiming = () => ({
  around: passThrough,
  stop: () => undefined,
});

/** Production and tests: no timing (the model is ignored). */
const useNoBoardTiming = (): StartTiming => untimed;

/** The board's timing hook: call it with the rendered model; start a
 * timing for each board model with the function it returns. */
export const useBoardTiming: (model: BoardModel) => StartTiming = ENABLED
  ? useDevBoardTiming
  : useNoBoardTiming;

/** The demo's simulated latency the URL asks for (`?latency=300`), in
 * development builds only (0: none); the simulator delays each response
 * by it (§3.14). */
export const demoLatency: () => number = ENABLED
  ? () => demoLatencyMs(window.location.search)
  : () => 0;
