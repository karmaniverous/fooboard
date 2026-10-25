/**
 * Timing for tests that render the demo page (spec.md §3.14): its board
 * (21 × 5 cells) takes seconds to render in jsdom, more on a busy runner,
 * so a visit gets longer than the default test timeout.
 *
 * @module
 */

/** A demo-page test's timeout. */
export const DEMO_RENDER_TIMEOUT_MS = 60_000;
