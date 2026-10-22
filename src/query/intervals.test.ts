/**
 * Tests for polling cadence (spec.md §3.1, Decision 26): 5 s while a fed
 * cell is in progress, 60 s otherwise, four times slower for a token past
 * half its budget; settled queries never poll; merged needs poll at the
 * faster rate.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_INTERVAL_MS,
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
    expect(ACTIVE_INTERVAL_MS).toBeLessThan(IDLE_INTERVAL_MS);
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
