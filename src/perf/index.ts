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
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel, EngineProviders } from '@/engine/types';

import { demoLatencyMs, withLatency } from './demoLatency';
import { type StartTiming, useDevBoardTiming } from './useDevBoardTiming';

const ENABLED = import.meta.env.DEV && import.meta.env.MODE !== 'test';

const untimed: StartTiming = (_dashboard: Dashboard, providers) => ({
  providers,
  stop: () => undefined,
});

/** Production and tests: no timing (the model is ignored). */
const useNoBoardTiming = (): StartTiming => untimed;

/** The board's timing hook: call it with the rendered model; start a
 * timing for each engine with the function it returns. */
export const useBoardTiming: (model: BoardModel) => StartTiming = ENABLED
  ? useDevBoardTiming
  : useNoBoardTiming;

/** The demo's providers, with the simulated latency the URL asks for
 * (`?latency=300`), in development builds only. */
export const withDemoLatency: (providers: EngineProviders) => EngineProviders =
  ENABLED
    ? (providers) =>
        withLatency(providers, demoLatencyMs(window.location.search))
    : (providers) => providers;
