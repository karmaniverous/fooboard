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

/** Options for `vi.waitFor` and Testing Library's `find*`/`waitFor`. */
export const WAIT = { timeout: MIN_TEST_TIMEOUT_MS } as const;
