/**
 * Tests for the attention store (spec 0.2.0 §3.H, Decision 91): a step
 * ends only when every root query of the row has completed a fetch since
 * it began; the boost ends after its last step's poll or at a completion
 * 75 s or more after it started; a dwell never cuts short a faster boost,
 * a click always restarts one; a dwell whose restart would postpone the
 * running poll (judged in real time, past half a budget too) begins it
 * when that poll completes, its cap counted from the dwell; boosts of rows no longer kept are dropped.
 * The cache reader takes only root needs, with data or an error.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_INTERVAL_MS,
  BOOST_MAX_MS,
  BUDGET_BACKOFF,
  DWELL_BOOST_START_MS,
  rootFreshness,
} from '@/query/intervals';
import { githubKey } from '@/query/keys';

import {
  type Completions,
  createAttention,
  rootCompletions,
} from './attention';
import type { Need } from './need';

const ROW = 'api';
/** Completions of the row's two root queries, `a` and `b`. */
const done = (a: number, b: number): Completions =>
  new Map([
    ['a', a],
    ['b', b],
  ]);

describe('the attention store', () => {
  it('steps on only once every root query has completed since the step began', () => {
    const store = createAttention();
    store.attend(ROW, 'click', 100, done(50, 50), 1);
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
    store.advance(ROW, done(200, 50), 200);
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
    store.advance(ROW, done(200, 300), 300);
    // The poll at once is done: the 5 s step began.
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
    store.advance(ROW, done(400, 400), 400);
    expect(store.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
  });

  it('never steps on a row with no root query', () => {
    const store = createAttention();
    store.attend(ROW, 'dwell', 0, new Map(), 1);
    store.advance(ROW, new Map(), 1);
    expect(store.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
  });

  it('ends after the last step’s poll', () => {
    const store = createAttention();
    store.attend(ROW, 'dwell', 0, done(0, 0), 1);
    const intervals: (number | undefined)[] = [];
    for (let t = 1; t <= 4; t += 1) {
      store.advance(ROW, done(t, t), t);
      intervals.push(store.intervalOf(ROW));
    }
    expect(intervals).toEqual([
      2 * DWELL_BOOST_START_MS,
      4 * DWELL_BOOST_START_MS,
      undefined,
      undefined,
    ]);
  });

  it('ends at a completed poll 75 s or more after it started, not before', () => {
    const store = createAttention();
    store.attend(ROW, 'click', 0, done(0, 0), 1);
    store.advance(ROW, done(1, 1), BOOST_MAX_MS - 1);
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
    store.advance(ROW, done(2, 2), BOOST_MAX_MS);
    expect(store.intervalOf(ROW)).toBeUndefined();
  });

  it('lets a dwell restart only a boost no faster than its own first step', () => {
    const store = createAttention();
    store.attend(ROW, 'click', 0, done(0, 0), 1);
    expect(store.attend(ROW, 'dwell', 1, done(0, 0), 1)).toBe(false);
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
    // Three polls on, the click is at 20 s: a dwell while that step's poll
    // is still 10 s or more off restarts it at 10 s.
    store.advance(ROW, done(1, 1), 2);
    store.advance(ROW, done(3, 3), 3);
    store.advance(ROW, done(4, 4), 4);
    expect(store.intervalOf(ROW)).toBe(2 * DWELL_BOOST_START_MS);
    const edge = 4 + DWELL_BOOST_START_MS;
    expect(store.attend(ROW, 'dwell', edge, done(4, 4), 1)).toBe(true);
    expect(store.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
    store.advance(ROW, done(edge + 1, edge + 1), edge + 1);
    expect(store.intervalOf(ROW)).toBe(2 * DWELL_BOOST_START_MS);
    expect(
      store.attend(ROW, 'click', edge + 2, done(edge + 1, edge + 1), 1),
    ).toBe(true);
    expect(store.intervalOf(ROW)).toBe(ACTIVE_INTERVAL_MS);
  });

  it("begins a dwell's restart on the running poll when that poll is due sooner", () => {
    const store = createAttention();
    store.attend(ROW, 'dwell', 0, done(0, 0), 1);
    store.advance(ROW, done(1, 1), 1);
    // The 20 s step's poll is due in under 10 s: it keeps its time.
    const dwell = 1 + DWELL_BOOST_START_MS + 1;
    expect(store.attend(ROW, 'dwell', dwell, done(1, 1), 1)).toBe(false);
    expect(store.intervalOf(ROW)).toBe(2 * DWELL_BOOST_START_MS);
    const polled = 1 + 2 * DWELL_BOOST_START_MS;
    store.advance(ROW, done(polled, polled), polled);
    expect(store.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
    // Its 75 s cap counts from the dwell.
    store.advance(
      ROW,
      done(dwell + BOOST_MAX_MS, dwell + BOOST_MAX_MS),
      dwell + BOOST_MAX_MS,
    );
    expect(store.intervalOf(ROW)).toBeUndefined();
  });

  it('ends a deferred restart whose awaited poll completes 75 s or more after the dwell', () => {
    const store = createAttention();
    store.attend(ROW, 'dwell', 0, done(0, 0), 1);
    store.advance(ROW, done(1, 1), 1);
    const dwell = 1 + DWELL_BOOST_START_MS + 1;
    expect(store.attend(ROW, 'dwell', dwell, done(1, 1), 1)).toBe(false);
    // The awaited poll is delayed (a hidden tab): no step begins at it.
    const late = dwell + BOOST_MAX_MS;
    const early = createAttention();
    early.attend(ROW, 'dwell', 0, done(0, 0), 1);
    early.advance(ROW, done(1, 1), 1);
    early.attend(ROW, 'dwell', dwell, done(1, 1), 1);
    early.advance(ROW, done(late - 1, late - 1), late - 1);
    expect(early.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
    store.advance(ROW, done(late, late), late);
    expect(store.intervalOf(ROW)).toBeUndefined();
  });

  it("judges a dwell's restart in real time past half a budget", () => {
    const store = createAttention();
    store.attend(ROW, 'dwell', 0, done(0, 0), BUDGET_BACKOFF);
    store.advance(ROW, done(1, 1), 1);
    // Four times slower, the 20 s step's poll is due at 80 s: a restart at
    // 20 s brings it to 60 s (unbacked, that poll would look due now).
    const dwell = 1 + 2 * DWELL_BOOST_START_MS;
    expect(store.attend(ROW, 'dwell', dwell, done(1, 1), BUDGET_BACKOFF)).toBe(
      true,
    );
    expect(store.intervalOf(ROW)).toBe(DWELL_BOOST_START_MS);
  });

  it('drops the boosts of rows no longer kept, and all on clear', () => {
    const store = createAttention();
    store.attend(ROW, 'click', 0, done(0, 0), 1);
    store.attend('other', 'click', 0, done(0, 0), 1);
    store.keep(new Set(['other']));
    expect(store.intervalOf(ROW)).toBeUndefined();
    expect(store.intervalOf('other')).toBe(ACTIVE_INTERVAL_MS);
    store.clear();
    expect(store.intervalOf('other')).toBeUndefined();
  });
});

describe('rootCompletions', () => {
  it('reads when each root query last completed, with data or an error', async () => {
    const client = new QueryClient();
    const need = (page: number, root: boolean): Need => ({
      key: githubKey('gh', { call: 'runs', repo: 'acme/api', page }),
      freshness: rootFreshness(false, false),
      ...(root ? { root } : {}),
    });
    const landed = need(1, true);
    const failed = need(2, true);
    client.setQueryData(landed.key, 'runs', { updatedAt: 10 });
    await client
      .query({
        queryKey: failed.key,
        queryFn: () => Promise.reject(new Error('down')),
        retry: false,
      })
      .catch(() => undefined);
    const failedAt = client.getQueryState(failed.key)?.errorUpdatedAt ?? 0;
    expect(failedAt).toBeGreaterThan(0);
    const out = rootCompletions(client, [
      landed,
      failed,
      need(3, true),
      need(4, false),
    ]);
    expect([...out.values()]).toEqual([10, failedAt, 0]);
  });
});
