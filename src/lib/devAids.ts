/**
 * Whether the development aids are on (spec.md §3.1, §3.5): the timing
 * session, the demo's simulated latency and the TanStack Query Devtools
 * run in development builds only, and never under tests. A production
 * build folds this to `false`, so the aids drop out of its bundle (which
 * `vite/noDevInstrumentation.ts` checks).
 *
 * @module
 */

/** A development build outside tests. */
export const DEV_AIDS = import.meta.env.DEV && import.meta.env.MODE !== 'test';
