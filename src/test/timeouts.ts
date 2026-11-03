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
 * re-deriving every row at each step, so it is the suite's slowest test:
 * about 10 s alone on a quiet machine, but about 40 s in a full run with
 * coverage on a busy one, past the minimum (before its step matched the
 * idle poll interval, it ran past 120 s). */
export const DEMO_COVERAGE_TIMEOUT_MS = 4 * MIN_TEST_TIMEOUT_MS;

/** The timeout of an e2e test that opens the demo board and runs axe on
 * it and its board actions (`e2e/a11y.spec.ts`, *on a phone*): four times
 * the minimum. Each full axe scan of the 21-row demo board takes seconds
 * on a quiet machine, and the test makes three; with four Playwright
 * workers each running axe on a busy machine, the 60 s default ran out. */
export const AXE_DEMO_TIMEOUT_MS = 4 * MIN_TEST_TIMEOUT_MS;

/** The timeout of the e2e axe tour (`e2e/a11y.spec.ts`): six times the
 * minimum. It scans home, the AI setup dialog, the demo board and its
 * actions, the menu, the cell detail sheet and the settings popup in one
 * test, about 2.5 min on a busy machine. */
export const AXE_TOUR_TIMEOUT_MS = 6 * MIN_TEST_TIMEOUT_MS;

/** Options for `vi.waitFor` and Testing Library's `find*`/`waitFor`. */
export const WAIT = { timeout: MIN_TEST_TIMEOUT_MS } as const;
