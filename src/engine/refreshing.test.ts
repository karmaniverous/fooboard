/**
 * Tests for the refreshing rule (spec.md §3.1, Decision 46): data is
 * refreshing while its query is fetching or once it is older than the
 * query's poll interval; fresh data, data never read and data that never
 * polls (a completed attempt's jobs) are not.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { NEVER_UPDATED } from '@/query/cache';
import { IDLE_INTERVAL_MS, pollEvery, SETTLED } from '@/query/intervals';

import { isRefreshing, markRefreshing } from './refreshing';

const LANDED = 1_000_000;
const idle = pollEvery(IDLE_INTERVAL_MS, false);
const read = (fetching = false, updatedAt = LANDED) => ({
  updatedAt,
  fetching,
});

describe('isRefreshing', () => {
  it.each([
    ['fresh data', read(), LANDED + IDLE_INTERVAL_MS, false],
    [
      'data one ms past its interval',
      read(),
      LANDED + IDLE_INTERVAL_MS + 1,
      true,
    ],
    ['fresh data whose query is fetching', read(true), LANDED, true],
    ['nothing read yet, fetching', read(true, NEVER_UPDATED), LANDED, false],
  ])('%s: %s', (_label, r, now, expected) => {
    expect(isRefreshing(r, idle, now)).toBe(expected);
  });

  it('never marks data that never polls by age', () => {
    expect(isRefreshing(read(), SETTLED, LANDED + IDLE_INTERVAL_MS * 10)).toBe(
      false,
    );
  });

  it('measures age against the query’s own interval', () => {
    const slow = pollEvery(IDLE_INTERVAL_MS * 2, false);
    expect(isRefreshing(read(), slow, LANDED + IDLE_INTERVAL_MS + 1)).toBe(
      false,
    );
  });
});

describe('markRefreshing', () => {
  const cells = { dev: { active: false }, prod: { active: true } };

  it('marks every cell when refreshing', () => {
    expect(markRefreshing(cells, true)).toEqual({
      dev: { active: false, refreshing: true },
      prod: { active: true, refreshing: true },
    });
  });

  it('leaves the cells alone otherwise', () => {
    expect(markRefreshing(cells, false)).toBe(cells);
  });
});
