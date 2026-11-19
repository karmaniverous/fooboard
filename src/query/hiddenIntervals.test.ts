/**
 * Tests for the hidden tab's cadence (spec §3.L, Decision 113): the ramp
 * from a row's own interval, growing by the ramp factor each hidden poll
 * up to exactly the period, with the defaults (from 5 s, 60 s and over
 * budget) and with custom settings; and a query's hidden freshness, never
 * faster than its own, its `staleTime` kept, a settled query still never
 * polling.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HIDDEN_POLL_MS,
  DEFAULT_HIDDEN_RAMP,
} from '@/domain/config/settings';

import {
  ACTIVE_INTERVAL_MS,
  BUDGET_BACKOFF,
  hiddenFreshness,
  hiddenInterval,
  type HiddenRamp,
  IDLE_INTERVAL_MS,
  pollEvery,
  rootFreshness,
  SETTLED,
} from './intervals';

const DEFAULTS: HiddenRamp = {
  rampFactor: DEFAULT_HIDDEN_RAMP,
  periodMs: DEFAULT_HIDDEN_POLL_MS,
};

/** The hidden intervals from `start` until the period is reached. */
function ramp(start: number, settings: HiddenRamp = DEFAULTS): number[] {
  const out: number[] = [];
  for (let polls = 0; ; polls += 1) {
    const interval = hiddenInterval(start, polls, settings);
    out.push(interval);
    if (interval >= settings.periodMs) return out;
  }
}

describe('hiddenInterval', () => {
  it('ramps an idle row from 60 s to 5 min in 8 polls, about 20 minutes', () => {
    const steps = ramp(IDLE_INTERVAL_MS);
    expect(steps).toEqual([
      60_000, 75_000, 93_750, 117_188, 146_484, 183_105, 228_882, 286_102,
      300_000,
    ]);
    const beforePeriod = steps.slice(0, -1);
    const elapsed = beforePeriod.reduce((sum, ms) => sum + ms, 0);
    expect(elapsed).toBeGreaterThan(19 * 60_000);
    expect(elapsed).toBeLessThan(21 * 60_000);
  });

  it('ramps an in-progress row from 5 s in 19 polls', () => {
    const steps = ramp(ACTIVE_INTERVAL_MS);
    expect(steps.slice(0, 3)).toEqual([5_000, 6_250, 7_813]);
    expect(steps).toHaveLength(20);
    expect(steps.at(-2)).toBe(277_556);
  });

  it('ramps an idle row over budget from 4 min in one poll', () => {
    expect(ramp(IDLE_INTERVAL_MS * BUDGET_BACKOFF)).toEqual([240_000, 300_000]);
  });

  it('caps exactly at the period, and stays there', () => {
    for (const polls of [8, 9, 50])
      expect(hiddenInterval(IDLE_INTERVAL_MS, polls, DEFAULTS)).toBe(
        DEFAULT_HIDDEN_POLL_MS,
      );
  });

  it('follows custom settings', () => {
    expect(
      ramp(IDLE_INTERVAL_MS, { rampFactor: 0.5, periodMs: 10 * 60_000 }),
    ).toEqual([60_000, 90_000, 135_000, 202_500, 303_750, 455_625, 600_000]);
    expect(ramp(IDLE_INTERVAL_MS, { rampFactor: 1, periodMs: 60_000 })).toEqual(
      [60_000],
    );
  });
});

describe('hiddenFreshness', () => {
  it('slows a faster query to the hidden interval, keeping its staleTime', () => {
    expect(hiddenFreshness(rootFreshness(true, false), 9_000)).toEqual({
      refetchInterval: 9_000,
      staleTime: ACTIVE_INTERVAL_MS,
    });
  });

  it('never polls faster hidden than visible', () => {
    const overBudget = rootFreshness(false, true);
    expect(hiddenFreshness(overBudget, IDLE_INTERVAL_MS)).toBe(overBudget);
    const compare = pollEvery(IDLE_INTERVAL_MS, false);
    expect(hiddenFreshness(compare, ACTIVE_INTERVAL_MS)).toBe(compare);
  });

  it('leaves a settled query never polling', () => {
    expect(hiddenFreshness(SETTLED, IDLE_INTERVAL_MS)).toBe(SETTLED);
  });
});
