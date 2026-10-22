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
import { DEV_AIDS } from '@/lib/devAids';
import { type Around, passThrough } from '@/query/instrument';

import { demoLatencyMs, latencyAround } from './demoLatency';
import { type StartTiming, useDevBoardTiming } from './useDevBoardTiming';

const untimed: StartTiming = () => ({
  around: passThrough,
  stop: () => undefined,
});

/** Production and tests: no timing (the model is ignored). */
const useNoBoardTiming = (): StartTiming => untimed;

/** The board's timing hook: call it with the rendered model; start a
 * timing for each board model with the function it returns. */
export const useBoardTiming: (model: BoardModel) => StartTiming = DEV_AIDS
  ? useDevBoardTiming
  : useNoBoardTiming;

/** The demo's simulated latency the URL asks for (`?latency=300`), in
 * development builds only; `undefined` for none. */
export const demoLatency: () => Around | undefined = DEV_AIDS
  ? () => latencyAround(demoLatencyMs(window.location.search))
  : () => undefined;
