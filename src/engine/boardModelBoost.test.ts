/**
 * Tests for the poll boost through the board model and TanStack's own
 * timers (spec 0.2.0 §3.H, Decisions 79, 85 and 91): when a boosted row
 * actually polls, with every timer and the clock fake. A click polls at
 * once, then 5, 10, 20 and 40 s apart; a dwell 10, 20 and 40 s apart;
 * each step begins when the row's previous poll completes; no step begins
 * 75 s or more after the boost started; then the row is back at 60 s.
 *
 * @module
 */
import { focusManager } from '@tanstack/query-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDLE_INTERVAL_MS } from '@/query/intervals';
import { BOOST_ROWS, boostBoard } from '@/test/boostBoard';

/** Long enough to see a boost through and the baseline poll after it. */
const WATCH_MS = 3 * IDLE_INTERVAL_MS;

const SECOND = 1_000;
const at = (...seconds: number[]) => seconds.map((s) => s * SECOND);
const row = BOOST_ROWS.github;

describe('the poll boost, as polled', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it('polls a clicked row at once, then 5, 10, 20 and 40 s apart, then at the baseline', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(row, since)).toEqual(at(0, 5, 15, 35, 75, 135));
    done();
  });

  it('polls a dwelt-on row 10, 20 and 40 s apart, with no poll at once', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'dwell');
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(row, since)).toEqual(at(10, 30, 70, 130));
    done();
  });

  it('takes a fetch already running as the poll at once, without cancelling it', async () => {
    const { env, board, polls, roots, hold, release, done } =
      await boostBoard();
    hold();
    const since = Date.now();
    for (const query of roots(row))
      env.client.refetchQueries({ queryKey: query.queryKey, exact: true });
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(2 * SECOND);
    expect(polls(row, since)).toEqual(at(0));
    release();
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    // The 5 s step began when the held poll completed, 2 s in.
    expect(polls(row, since).slice(0, 5)).toEqual(at(0, 7, 17, 37, 77));
    done();
  });

  it('delays the next step for a poll that completes late, its interval unchanged meanwhile', async () => {
    const { board, polls, intervals, hold, release, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'dwell');
    await vi.advanceTimersByTimeAsync(9 * SECOND);
    hold();
    await vi.advanceTimersByTimeAsync(11 * SECOND);
    expect(intervals(row)).toEqual([10 * SECOND]);
    await vi.advanceTimersByTimeAsync(5 * SECOND);
    release();
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(row, since).slice(0, 4)).toEqual(at(10, 45, 85, 145));
    done();
  });

  it('carries a boost on after the tab returns within 75 s', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(SECOND);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(29 * SECOND);
    expect(polls(row, since)).toEqual(at(0));
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    // The return's refetch completed the 5 s step; 10, 20 and 40 s follow.
    expect(polls(row, since).slice(0, 5)).toEqual(at(0, 30, 40, 60, 100));
    done();
  });

  it('ends a boost when the tab returns 75 s or more after it started', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(SECOND);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(89 * SECOND);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(row, since).slice(0, 3)).toEqual(at(0, 90, 150));
    done();
  });

  it("never lets a dwell slow a click's boost; a new click restarts it", async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(2 * SECOND);
    board.attend([row.id], 'dwell');
    await vi.advanceTimersByTimeAsync(18 * SECOND);
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(row, since).slice(0, 7)).toEqual(at(0, 5, 15, 20, 25, 35, 55));
    done();
  });

  it('boosts only the rows attended to', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    expect(polls(BOOST_ROWS.other, since)).toEqual(at(59, 119, 179));
    done();
  });
});
