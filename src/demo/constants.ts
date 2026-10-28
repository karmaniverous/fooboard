/**
 * The simulated demo's named constants (spec.md §3.14): its fixed seed,
 * the viewport its board fills, the window of simulated time its coverage
 * test watches, and its dashboard's id (which the development timing
 * reads to tell the demo from a real board).
 *
 * @module
 */

/** The shipped scenario's seed (Q31): every visit plays the same
 * timeline from its opening, so screenshots, design proofs and tests are
 * reproducible, and the coverage test proves what a visitor sees. */
export const DEMO_SEED = 20261025;

/** A typical desktop (Q30, Decision 54): a maximised browser on a 1080p
 * screen, whose own toolbars take the rest of the height, at 100% zoom,
 * Default density, with the app header shown. The demo board has the
 * most rows that fit it without vertical scrolling: 21 (spec.md §3.14;
 * one more would scroll), at a one-line rung. */
export const DEMO_VIEWPORT = { width: 1920, height: 950 } as const;

/** How much simulated time the coverage test watches: within it the demo
 * shows everything §3.14 lists (10 minutes, as proposed). */
export const DEMO_COVERAGE_WINDOW_MS = 10 * 60_000;

/** The demo dashboard's id, in every scenario. */
export const DEMO_DASHBOARD_ID = 'demo';
