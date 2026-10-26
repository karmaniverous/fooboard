/**
 * Development aid (spec.md §3.5, Decisions 30 and 45): the names of the
 * timing marks and measures, and the performance targets the console
 * summary reports against. Every name starts with
 * {@link TIMING_PREFIX}, which the production build checks for
 * (`vite/noDevInstrumentation.ts`): a production bundle must contain none
 * of this.
 *
 * @module
 */

/** Prefix of every timing mark and measure, and of the console summary. */
export const TIMING_PREFIX = 'fooboard-timing';

/** Mark and measure names (User Timing). */
export const TIMING_NAMES = {
  /** Mark: the board model started (the board opened). */
  open: `${TIMING_PREFIX}:open`,
  /** Mark and measure: the first non-empty status cell was committed. */
  firstCell: `${TIMING_PREFIX}:first-cell`,
  /** Mark and measure: every cell final and every compare settled. */
  fullBoard: `${TIMING_PREFIX}:full-board`,
  /** Measure prefix, one per request: `…:request <provider> <kind>`. */
  request: `${TIMING_PREFIX}:request`,
} as const;

/** The demo's simulated latency the demo targets assume (ms). */
export const DEMO_TARGET_LATENCY_MS = 300;
/** Requests in flight the demo targets assume (Next Version, N2). */
const DEMO_TARGET_IN_FLIGHT = 10;
/** Demo: the first cell within this long of opening (ms). */
export const DEMO_FIRST_CELL_MAX_MS = 1_500;
/** Demo: the full board within this long of opening (ms), on the
 * development-only measurement scenario (Decision 61, replacing Decision
 * 45's interim 8 s: the simulator charges its latency per HTTP request). */
export const DEMO_FULL_BOARD_MAX_MS = 11_000;
/** Reload: the cached board within this long of the page loading (ms). */
export const RELOAD_FULL_BOARD_MAX_MS = 500;
/** The 16-repo validation board on a cold cache: full board (ms).
 * Interim (Decision 45 item 1, replacing Decision 30's 15 s): revisited
 * in N8, after N3's persisted cache. */
export const REAL_COLD_FULL_BOARD_MAX_MS = 30_000;
/** At one request in flight per credential, full board may be at most
 * this fraction slower than the N1 baseline. */
export const ONE_IN_FLIGHT_MAX_SLOWDOWN = 0.1;

/** Which measure a target bounds. */
export type Measure = 'firstCell' | 'fullBoard';
/** Which boards a target is for. */
export type BoardKind = 'demo' | 'real';
/** Measured from the board opening, or from the page (re)loading. */
export type Origin = 'open' | 'reload';

/** One Decision 30 target (as Decision 45 amends it). */
export interface PerformanceTarget {
  label: string;
  board: BoardKind | 'any';
  measure: Measure;
  from: Origin;
  maxMs: number;
}

/** Decision 30's targets (Decision 45's interim full-board ones), as the
 * summary reports them. The relative
 * one-in-flight target ({@link ONE_IN_FLIGHT_MAX_SLOWDOWN}) has no fixed
 * number until a baseline exists, so the summary states it as a note. */
export const PERFORMANCE_TARGETS: readonly PerformanceTarget[] = [
  {
    label: `Demo (${String(DEMO_TARGET_LATENCY_MS)} ms latency, ${String(DEMO_TARGET_IN_FLIGHT)} in flight): first cell`,
    board: 'demo',
    measure: 'firstCell',
    from: 'open',
    maxMs: DEMO_FIRST_CELL_MAX_MS,
  },
  {
    label: `Demo (${String(DEMO_TARGET_LATENCY_MS)} ms latency, ${String(DEMO_TARGET_IN_FLIGHT)} in flight): full board`,
    board: 'demo',
    measure: 'fullBoard',
    from: 'open',
    maxMs: DEMO_FULL_BOARD_MAX_MS,
  },
  {
    label: 'Reload: cached board',
    board: 'any',
    measure: 'fullBoard',
    from: 'reload',
    maxMs: RELOAD_FULL_BOARD_MAX_MS,
  },
  {
    label: 'Real board, cold cache: full board',
    board: 'real',
    measure: 'fullBoard',
    from: 'open',
    maxMs: REAL_COLD_FULL_BOARD_MAX_MS,
  },
];
