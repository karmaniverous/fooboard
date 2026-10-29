/**
 * Tests for polling cadence (spec.md §3.1, Decision 26): 5 s while a fed
 * cell is in progress, 60 s otherwise, four times slower for a token past
 * half its budget; settled queries never poll; merged needs poll at the
 * faster rate. A boost's steps (spec 0.2.0 §3.H): a click's 5, 10, 20
 * and 40 s after its poll at once, a dwell's from 10 s, each backed off
 * past half the budget and never slower than the row's own cadence.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_INTERVAL_MS,
  boostedRootFreshness,
  boostInterval,
  BUDGET_BACKOFF,
  faster,
  IDLE_INTERVAL_MS,
  pollEvery,
  rootFreshness,
  SETTLED,
} from './intervals';

describe('polling cadence', () => {
  it('polls active rows fast and idle rows slowly, data stale as it polls', () => {
    expect(rootFreshness(true, false)).toEqual({
      refetchInterval: ACTIVE_INTERVAL_MS,
      staleTime: ACTIVE_INTERVAL_MS,
    });
    expect(rootFreshness(false, false)).toEqual({
      refetchInterval: IDLE_INTERVAL_MS,
      staleTime: IDLE_INTERVAL_MS,
    });
  });

  it('backs off a token past half its budget', () => {
    expect(rootFreshness(true, true).refetchInterval).toBe(
      ACTIVE_INTERVAL_MS * BUDGET_BACKOFF,
    );
    expect(pollEvery(IDLE_INTERVAL_MS, true)).toEqual({
      refetchInterval: IDLE_INTERVAL_MS * BUDGET_BACKOFF,
      staleTime: IDLE_INTERVAL_MS * BUDGET_BACKOFF,
    });
  });

  it('keeps the faster of two needs, a settled one never winning', () => {
    const fast = pollEvery(ACTIVE_INTERVAL_MS, false);
    const slow = pollEvery(IDLE_INTERVAL_MS, false);
    expect(faster(fast, slow)).toBe(fast);
    expect(faster(slow, fast)).toBe(fast);
    expect(faster(SETTLED, slow)).toBe(slow);
    expect(faster(slow, SETTLED)).toBe(slow);
    expect(faster(SETTLED, SETTLED)).toBe(SETTLED);
  });
});

describe('boost steps', () => {
  const SECOND = 1_000;
  /** A kind's intervals after 0, 1, … completed polls, until it ends. */
  const steps = (kind: 'click' | 'dwell') => {
    const out: number[] = [];
    for (let polls = 0; ; polls += 1) {
      const interval = boostInterval(kind, polls);
      if (interval === undefined) return out;
      out.push(interval / SECOND);
    }
  };

  it('steps a click through 5, 10, 20 and 40 s after its poll at once', () => {
    expect(steps('click')).toEqual([5, 5, 10, 20, 40]);
  });

  it('starts a dwell one step later, with no poll at once', () => {
    expect(steps('dwell')).toEqual([10, 20, 40]);
  });

  it('polls at the faster of the row’s cadence and its boost, backed off', () => {
    expect(boostedRootFreshness(false, false, undefined)).toEqual(
      rootFreshness(false, false),
    );
    expect(boostedRootFreshness(false, false, 10 * SECOND)).toEqual(
      pollEvery(10 * SECOND, false),
    );
    expect(boostedRootFreshness(true, false, 10 * SECOND)).toEqual(
      rootFreshness(true, false),
    );
    expect(
      boostedRootFreshness(false, true, ACTIVE_INTERVAL_MS).refetchInterval,
    ).toBe(ACTIVE_INTERVAL_MS * BUDGET_BACKOFF);
  });
});
