/**
 * Tests for the layout's data snapshot (spec.md C-13): polled changes
 * reach it at most once per idle interval and never mid-interaction,
 * while a new board shape or the first data applies at once.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BoardModel } from '@/engine';

import { useStableModel } from './useStableModel';

const model = (n: number): BoardModel => ({
  cells: Object.fromEntries(
    Array.from({ length: n }, (_, i): [string, undefined] => [
      `c${String(i)}`,
      undefined,
    ]),
  ),
  unmapped: [],
  problems: [],
  amplifyBranches: [],
  amplifyKeyApps: {},
  budgets: {},
  refreshedAt: {},
});

describe('useStableModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies first data and shape changes at once, polled data once a minute when idle', () => {
    let interacting = false;
    const empty = model(0);
    const first = model(2);
    const polled = model(2);
    const { result, rerender } = renderHook(
      ({ m, shape }) => useStableModel(m, shape, () => interacting),
      { initialProps: { m: empty, shape: 'a' } },
    );
    rerender({ m: first, shape: 'a' });
    expect(result.current).toBe(first);

    rerender({ m: polled, shape: 'a' });
    expect(result.current).toBe(first);
    interacting = true;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(first);
    interacting = false;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(polled);

    const more = model(4);
    rerender({ m: more, shape: 'a' });
    expect(result.current).toBe(more);

    const reshaped = model(3);
    rerender({ m: reshaped, shape: 'b' });
    expect(result.current).toBe(reshaped);
  });
});
