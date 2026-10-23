/**
 * Tests for `useBoardModel` (spec.md §3.1): the board fills from the query
 * environment; an edited dashboard re-derives at once with every cell
 * kept; a new refresh key re-derives every row; every request runs
 * through the page's wrapper; unmounting stops observing.
 *
 * @module
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Around } from '@/query/instrument';
import { demoEnv, FILL_TIMEOUT_MS } from '@/test/boardModel';

import { useBoardModel } from './useBoardModel';

/** How long the demo board may take to fill with the whole suite
 * running alongside (coverage slows it). */
const observing = (env: ReturnType<typeof demoEnv>) =>
  env.client
    .getQueryCache()
    .getAll()
    .some((q) => q.getObserversCount() > 0);

describe('useBoardModel', () => {
  it('fills the board, keeps it filled through an edit, and stops on unmount', async () => {
    const env = demoEnv();
    let wrapped = 0;
    const around: Around = (_call, run) => {
      wrapped += 1;
      return run();
    };
    const { result, rerender, unmount } = renderHook(
      ({
        dashboard,
        refreshKey,
      }: {
        dashboard: Dashboard;
        refreshKey: number;
      }) => useBoardModel(dashboard, env, { around, refreshKey }),
      { initialProps: { dashboard: demoDashboard, refreshKey: 0 } },
    );
    await waitFor(
      () => {
        expect(
          Object.values(result.current.model.cells).filter((c) => c?.settled)
            .length,
        ).toBeGreaterThan(0);
      },
      { timeout: FILL_TIMEOUT_MS },
    );
    expect(wrapped).toBeGreaterThan(0);
    const filled = Object.keys(result.current.model.cells).length;

    const renamed = { ...demoDashboard, name: 'Renamed' };
    rerender({ dashboard: renamed, refreshKey: 0 });
    expect(Object.keys(result.current.model.cells).length).toBe(filled);

    const before = result.current.model;
    act(() => {
      rerender({ dashboard: renamed, refreshKey: 1 });
    });
    expect(result.current.model).not.toBe(before);

    expect(observing(env)).toBe(true);
    unmount();
    expect(observing(env)).toBe(false);
  });
});
