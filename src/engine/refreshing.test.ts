/**
 * Tests for the refreshing rule (spec.md §3.1, Decisions 46 and 47): data
 * is refreshing once its query has been fetching longer than
 * `REFRESHING_DELAY_MS`, or once it is older than the query's poll
 * interval, at once; a quicker fetch, fresh data, data never read and
 * data that never polls (a completed attempt's jobs) are not.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { ADDED_RUN_JOBS_DELAY_MS } from '@/demo/addedRun';
import { NEVER_UPDATED } from '@/query/cache';
import { IDLE_INTERVAL_MS, pollEvery, SETTLED } from '@/query/intervals';

import {
  isRefreshing,
  markRefreshing,
  type RefreshClock,
  REFRESHING_DELAY_MS,
} from './refreshing';

const LANDED = 1_000_000;
const HASH = '["runs"]';
const idle = pollEvery(IDLE_INTERVAL_MS, false);
const read = (fetching = false, updatedAt = LANDED) => ({
  updatedAt,
  fetching,
  queryHash: HASH,
});
/** The clock at `now`, `HASH`'s fetch having started at `startedAt`. */
const clock = (now: number, startedAt?: number): RefreshClock => ({
  now,
  fetchStartedAt: (hash) => (hash === HASH ? startedAt : undefined),
});
/** The slowest poll measured on the demo board (Decision 47). */
const SLOWEST_MEASURED_POLL_MS = 180;

/** Fresh data's clock, its fetch having run for `ms`. */
const fetchedFor = (ms: number) => clock(LANDED + ms, LANDED);

describe('isRefreshing', () => {
  it.each([
    ['fresh data', read(), clock(LANDED + IDLE_INTERVAL_MS), false],
    [
      'data one ms past its interval',
      read(),
      clock(LANDED + IDLE_INTERVAL_MS + 1),
      true,
    ],
    [
      'fresh data fetching for exactly the delay',
      read(true),
      fetchedFor(REFRESHING_DELAY_MS),
      false,
    ],
    [
      'fresh data fetching one ms past the delay',
      read(true),
      fetchedFor(REFRESHING_DELAY_MS + 1),
      true,
    ],
    [
      'fresh data during the slowest measured poll',
      read(true),
      fetchedFor(SLOWEST_MEASURED_POLL_MS),
      false,
    ],
    [
      'fresh data fetching as long as the demo’s added-run jobs',
      read(true),
      fetchedFor(ADDED_RUN_JOBS_DELAY_MS),
      true,
    ],
    [
      'fresh data fetching with no start recorded',
      read(true),
      clock(LANDED + REFRESHING_DELAY_MS + 1),
      false,
    ],
    [
      'a start recorded for a query no longer fetching',
      read(),
      fetchedFor(REFRESHING_DELAY_MS + 1),
      false,
    ],
    [
      'overdue data whose fetch has just started',
      read(true),
      clock(LANDED + IDLE_INTERVAL_MS + 1, LANDED + IDLE_INTERVAL_MS + 1),
      true,
    ],
    [
      'nothing read yet, fetching past the delay',
      read(true, NEVER_UPDATED),
      fetchedFor(REFRESHING_DELAY_MS + 1),
      false,
    ],
  ])('%s', (_label, r, at, expected) => {
    expect(isRefreshing(r, idle, at)).toBe(expected);
  });

  it('never marks data that never polls by age', () => {
    expect(
      isRefreshing(read(), SETTLED, clock(LANDED + IDLE_INTERVAL_MS * 10)),
    ).toBe(false);
  });

  it('measures age against the query’s own interval', () => {
    const slow = pollEvery(IDLE_INTERVAL_MS * 2, false);
    expect(
      isRefreshing(read(), slow, clock(LANDED + IDLE_INTERVAL_MS + 1)),
    ).toBe(false);
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
