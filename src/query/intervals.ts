/**
 * Polling cadence and freshness (spec.md §3.1, Decisions 3, 29 and 45):
 * root queries poll every 5 s while a cell they feed is in progress and
 * every 60 s otherwise; an in-progress run's jobs every 5 s; compares at
 * the idle interval; each four times slower for a GitHub token past half
 * its hourly budget (Decision 45 item 4). A completed attempt's jobs
 * never refetch. A query's `staleTime` equals its current
 * `refetchInterval`, so focus and reconnect refetch only what is due.
 *
 * A row the user shows interest in polls faster for a while (spec 0.2.0
 * §3.H, Decisions 79, 85 and 91): a click's boost steps through
 * `BOOST_STEPS` (5, 10, 20 and 40 s) after a poll at once, a dwell's
 * from `DWELL_BOOST_START_MS` (10, 20 and 40 s), each step lasting one
 * completed poll, none beginning `BOOST_MAX_MS` after the boost started.
 *
 * @module
 */

/** Poll interval while a fed cell is in progress (C-16). */
export const ACTIVE_INTERVAL_MS = 5_000;
/** Poll interval otherwise; also the layout's data interval (§3.1). */
export const IDLE_INTERVAL_MS = 60_000;
/** Interval multiplier for a GitHub token past half its budget. */
export const BUDGET_BACKOFF = 4;
/** How long an editor lookup (repos, branches, apps) stays fresh. */
export const EDITOR_STALE_MS = 5 * 60_000;
/** How often the board's app search lists each region again (spec.md
 * §3.12): hourly, and on focus once stale. */
export const APP_SEARCH_INTERVAL_MS = 60 * 60_000;

/** How often a query polls, and when its data goes stale. */
export interface Freshness {
  /** `false`: never polls. */
  refetchInterval: number | false;
  staleTime: number;
}

/** A completed attempt's jobs: fresh for good, never polled. */
export const SETTLED: Freshness = {
  refetchInterval: false,
  staleTime: Infinity,
};

/** Poll every `base` ms, ×`BUDGET_BACKOFF` when `overBudget`. */
export function pollEvery(base: number, overBudget: boolean): Freshness {
  const interval = base * (overBudget ? BUDGET_BACKOFF : 1);
  return { refetchInterval: interval, staleTime: interval };
}

/** The app search's cadence (spec.md §3.12). */
export const APP_SEARCH_FRESHNESS: Freshness = pollEvery(
  APP_SEARCH_INTERVAL_MS,
  false,
);

/** A root query's cadence: fast while a fed cell is in progress. */
export const rootFreshness = (
  active: boolean,
  overBudget: boolean,
): Freshness =>
  pollEvery(active ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS, overBudget);

/** The faster of two cadences (a query feeding several rows). */
export function faster(a: Freshness, b: Freshness): Freshness {
  const interval = (f: Freshness) =>
    f.refetchInterval === false ? Infinity : f.refetchInterval;
  return interval(a) <= interval(b) ? a : b;
}

/** How much longer each boost step is than the one before (Decision
 * 79: the interval doubles after each poll). */
const BOOST_GROWTH = 2;

/** Where a dwell's boost starts: one step after a click's, so a dwell,
 * the weaker signal, costs under half a click's extra polls (Decision
 * 85 item 1). */
export const DWELL_BOOST_START_MS = ACTIVE_INTERVAL_MS * BOOST_GROWTH;

/** No boost step begins this long or longer after the boost started
 * (Decision 91): it bounds a boost whose polls are delayed (a hidden tab,
 * a paused credential) to the time an on-time click's steps take. */
export const BOOST_MAX_MS = 75_000;

/** A boost's step intervals, unmultiplied: from `ACTIVE_INTERVAL_MS`,
 * each `BOOST_GROWTH` times the last, while shorter than the baseline
 * `IDLE_INTERVAL_MS` (5, 10, 20 and 40 s). */
const BOOST_STEPS: readonly number[] = (() => {
  const steps: number[] = [];
  for (let ms = ACTIVE_INTERVAL_MS; ms < IDLE_INTERVAL_MS; ms *= BOOST_GROWTH)
    steps.push(ms);
  return steps;
})();

/** What started a boost: a click (or opening settings), or a dwell. */
export type BoostKind = 'click' | 'dwell';

/** Where each kind's steps start in `BOOST_STEPS`; a click's poll at
 * once comes before its first step, at that step's interval. */
const FIRST_STEP: Record<BoostKind, number> = {
  click: 0,
  dwell: BOOST_STEPS.indexOf(DWELL_BOOST_START_MS),
};

/**
 * A `kind` boost's interval (unmultiplied) once `polls` of its polls have
 * completed, or `undefined` when it has run its steps. A click's first
 * poll is its poll at once, under way at its first step's interval.
 */
export function boostInterval(
  kind: BoostKind,
  polls: number,
): number | undefined {
  const step = FIRST_STEP[kind] + (kind === 'click' ? polls - 1 : polls);
  return BOOST_STEPS[Math.max(step, FIRST_STEP[kind])];
}

/** A root query's cadence with a row's boost (spec 0.2.0 §3.H): the
 * faster of its own and the boost's interval, both backed off past half
 * a token's budget. */
export const boostedRootFreshness = (
  active: boolean,
  overBudget: boolean,
  boost: number | undefined,
): Freshness =>
  boost === undefined
    ? rootFreshness(active, overBudget)
    : faster(rootFreshness(active, overBudget), pollEvery(boost, overBudget));
