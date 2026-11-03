/**
 * The test suite's timeouts. No timeout is shorter than
 * `MIN_TEST_TIMEOUT_MS` (Jason, 2026-10-28): a busy or slow machine runs
 * the suite several times slower than CI, and a short timeout then fails a
 * test that is only slow. A timeout only bounds how long a failing test
 * takes to report; a passing test never waits for it.
 *
 * @module
 */

/** The shortest timeout anywhere in the suite: tests, hooks and waits. */
export const MIN_TEST_TIMEOUT_MS = 30_000;

/** The demo coverage test's timeout (`acme.coverage.test.ts`): four
 * times the minimum. It plays the shipped scenario's whole board through
 * `DEMO_COVERAGE_WINDOW_MS` of simulated time, re-reading and
 * re-deriving every row at each step, so it is the suite's slowest test
 * by far: about 10 s alone on an idle machine, and several times that in
 * a full run with coverage on a busy one, past the minimum (it once
 * needed 120 s, before its step matched the idle poll interval). */
export const DEMO_COVERAGE_TIMEOUT_MS = 4 * MIN_TEST_TIMEOUT_MS;

/** Options for `vi.waitFor` and Testing Library's `find*`/`waitFor`. */
export const WAIT = { timeout: MIN_TEST_TIMEOUT_MS } as const;
