/**
 * Tests for the poll scheduler with fake timers: active vs idle intervals,
 * the over-budget backoff, pausing while hidden and catching up on return.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_INTERVAL_MS,
  BUDGET_BACKOFF,
  createPollScheduler,
  IDLE_INTERVAL_MS,
  type Visibility,
} from './scheduler';

function fakeVisibility(): Visibility & { set(hidden: boolean): void } {
  let hidden = false;
  const listeners = new Set<() => void>();
  return {
    isHidden: () => hidden,
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(next) {
      hidden = next;
      for (const l of listeners) l();
    },
  };
}

const target = (active: boolean) => ({
  id: 't',
  refresh: vi.fn(() => Promise.resolve()),
  isActive: () => active,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createPollScheduler', () => {
  it.each([
    ['active', true, false, ACTIVE_INTERVAL_MS],
    ['idle', false, false, IDLE_INTERVAL_MS],
    ['active over budget', true, true, ACTIVE_INTERVAL_MS * BUDGET_BACKOFF],
  ])('repolls %s targets on schedule', async (_l, active, over, interval) => {
    const t = target(active);
    const s = createPollScheduler({
      targets: [t],
      overBudget: () => over,
      visibility: fakeVisibility(),
    });
    s.start();
    await vi.advanceTimersByTimeAsync(interval - 1);
    expect(t.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.refresh).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it('pauses while hidden and refreshes on return', async () => {
    const t = target(true);
    const visibility = fakeVisibility();
    const s = createPollScheduler({
      targets: [t],
      overBudget: () => false,
      visibility,
    });
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(10 * IDLE_INTERVAL_MS);
    expect(t.refresh).toHaveBeenCalledTimes(1);
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.refresh).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it('stops polling after stop()', async () => {
    const t = target(true);
    const s = createPollScheduler({
      targets: [t],
      overBudget: () => false,
      visibility: fakeVisibility(),
    });
    s.start();
    s.stop();
    await vi.advanceTimersByTimeAsync(10 * IDLE_INTERVAL_MS);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });
});
