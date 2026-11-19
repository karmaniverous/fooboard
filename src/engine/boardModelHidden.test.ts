/**
 * Tests for polling while the tab is hidden, through the board model and
 * TanStack's own timers (spec §3.L, Decision 113), with every timer and
 * the clock fake: hidden, an idle row polls 60, 75 and 93.75 s apart, each
 * step beginning when its poll completes; hiding restarts no timer; on
 * return every observer is back at its visible interval at once and what
 * is due is re-read; no boost runs hidden (a click does nothing, and a
 * running boost gives way to the ramp); the dashboard's settings apply.
 *
 * @module
 */
import { focusManager } from '@tanstack/query-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDLE_INTERVAL_MS } from '@/query/intervals';
import { BOOST_ROWS, boostBoard, boostDashboard } from '@/test/boostBoard';

const SECOND = 1_000;
const at = (...seconds: number[]) => seconds.map((s) => s * SECOND);
const row = BOOST_ROWS.github;
/** Long enough to see four hidden polls of an idle row. */
const RAMP_MS = (60 + 75 + 93.75 + 117.188 + 10) * SECOND;

describe('polling while the tab is hidden', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it('keeps polling an idle row, each poll 25% later than the last', async () => {
    const { polls, intervals, done } = await boostBoard();
    const since = Date.now();
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(0);
    // Hiding restarts no timer: the first hidden poll keeps its time.
    expect(intervals(row)).toEqual([IDLE_INTERVAL_MS]);
    await vi.advanceTimersByTimeAsync(RAMP_MS);
    expect(polls(row, since)).toEqual(at(59, 134, 227.75, 344.938));
    done();
  });

  it('follows the dashboard settings', async () => {
    const { polls, done } = await boostBoard({
      ...boostDashboard,
      settings: {
        ...boostDashboard.settings,
        hiddenPolling: { periodMs: 90_000, rampFactor: 1 },
      },
    });
    const since = Date.now();
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(4 * IDLE_INTERVAL_MS);
    // 60 s, then doubling, held at the 90 s period.
    expect(polls(row, since)).toEqual(at(59, 149, 239));
    done();
  });

  it('resumes the visible cadence at once on return, re-reading what is due', async () => {
    const { polls, intervals, done } = await boostBoard();
    const since = Date.now();
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(130 * SECOND);
    // Polled at 59 s; the next hidden poll is 75 s later, at 134 s.
    expect(intervals(row)).toEqual([75 * SECOND]);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(intervals(row)).toEqual([IDLE_INTERVAL_MS]);
    // Its data, 71 s old, is due: the return reads it at once.
    expect(polls(row, since)).toEqual(at(59, 130));
    await vi.advanceTimersByTimeAsync(IDLE_INTERVAL_MS);
    expect(polls(row, since)).toEqual(at(59, 130, 190));
    done();
  });

  it('runs no boost while hidden', async () => {
    const { board, polls, done } = await boostBoard();
    const since = Date.now();
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(SECOND);
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(IDLE_INTERVAL_MS);
    // No poll at once and no 5 s steps: only the hidden ramp's poll.
    expect(polls(row, since)).toEqual(at(59));
    done();
  });

  it('lets a running boost give way to the ramp when the tab hides', async () => {
    const { board, polls, intervals, done } = await boostBoard();
    const since = Date.now();
    board.attend([row.id], 'click');
    await vi.advanceTimersByTimeAsync(2 * SECOND);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(intervals(row)).toEqual([IDLE_INTERVAL_MS]);
    await vi.advanceTimersByTimeAsync(IDLE_INTERVAL_MS);
    // The poll at once, then the row's own 60 s from the hiding.
    expect(polls(row, since)).toEqual(at(0, 62));
    done();
  });
});
