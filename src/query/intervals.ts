/**
 * Polling cadence and freshness (spec.md §3.1, Decisions 3, 29 and 45):
 * root queries poll every 5 s while a cell they feed is in progress and
 * every 60 s otherwise; an in-progress run's jobs every 5 s; compares at
 * the idle interval; each four times slower for a GitHub token past half
 * its hourly budget (Decision 45 item 4). A completed attempt's jobs
 * never refetch. A query's `staleTime` equals its current
 * `refetchInterval`, so focus and reconnect refetch only what is due.
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
