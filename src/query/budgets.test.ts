/**
 * Tests for the budget store's forward-only readings (spec 0.2.0 §3.J
 * *Batteries and the first poll*, Decision 109): a later `reset` replaces
 * the reading; the same `reset` keeps the fewer requests left, whichever
 * arrives first; an earlier `reset` is ignored; subscribers hear only a
 * change.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import type { RateLimitBudget } from '@/lib/github';

import { createBudgetStore } from './budgets';

const LIMIT = 5000;
const WINDOW = 1_800_000_000;
const NEXT_WINDOW = WINDOW + 3600;

const reading = (reset: number, remaining: number): RateLimitBudget => ({
  limit: LIMIT,
  remaining,
  reset,
  used: LIMIT - remaining,
  status: 'ok',
});

/** A store that has heard `readings` in order, and how often it told a
 * subscriber. */
function heard(...readings: RateLimitBudget[]) {
  const store = createBudgetStore();
  const listener = vi.fn();
  store.subscribe(listener);
  for (const r of readings) store.note('gh', r);
  return { store, listener };
}

describe('the budget store', () => {
  it('takes the first reading', () => {
    const { store, listener } = heard(reading(WINDOW, 4000));
    expect(store.get('gh')).toEqual(reading(WINDOW, 4000));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('replaces a reading with one from a later window, even with more left', () => {
    const { store, listener } = heard(
      reading(WINDOW, 100),
      reading(NEXT_WINDOW, 4999),
    );
    expect(store.get('gh')).toEqual(reading(NEXT_WINDOW, 4999));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it.each([
    [3000, 3500],
    [3500, 3000],
  ] as const)(
    'keeps the fewer requests left within one window (%i, then %i)',
    (first, second) => {
      const { store } = heard(reading(WINDOW, first), reading(WINDOW, second));
      expect(store.get('gh')?.remaining).toBe(3000);
    },
  );

  it('ignores a reading from an earlier window, and tells no one', () => {
    const { store, listener } = heard(
      reading(NEXT_WINDOW, 4999),
      reading(WINDOW, 10),
    );
    expect(store.get('gh')).toEqual(reading(NEXT_WINDOW, 4999));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('tells no one when a reading changes nothing', () => {
    const { listener } = heard(
      reading(WINDOW, 3000),
      reading(WINDOW, 3000),
      reading(WINDOW, 3500),
    );
    expect(listener).toHaveBeenCalledOnce();
  });

  it('takes any reading again once forgotten', () => {
    const { store } = heard(reading(NEXT_WINDOW, 100));
    store.forget('gh');
    store.note('gh', reading(WINDOW, 4000));
    expect(store.get('gh')).toEqual(reading(WINDOW, 4000));
  });

  it('keeps each credential to its own readings', () => {
    const { store } = heard(reading(NEXT_WINDOW, 100));
    store.note('other', reading(WINDOW, 4000));
    expect(store.get('other')).toEqual(reading(WINDOW, 4000));
    expect(store.get('gh')).toEqual(reading(NEXT_WINDOW, 100));
  });
});
