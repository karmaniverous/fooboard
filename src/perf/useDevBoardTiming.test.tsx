import { renderHook, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { createBoardEngine, demoProviders } from '@/engine';
import { emptyModel } from '@/engine/model';

import type { TimingSink } from './session';
import type { TimingSummary } from './summary';
import { type PageTiming, useDevBoardTiming } from './useDevBoardTiming';

/** A board like `useBoardEngine`'s: each mount times its own engine. */
function useTimedBoard(
  dashboard: Dashboard,
  page: PageTiming,
  reports: TimingSummary[],
) {
  const [model, setModel] = useState(emptyModel);
  const start = useDevBoardTiming(model, {
    page,
    clock: () => performance.now(),
    search: () => '?latency=300',
    navigation: () => 'reload',
    sink: (): TimingSink => ({
      mark: () => undefined,
      measure: () => undefined,
      report: (s) => reports.push(s),
    }),
  });
  useEffect(() => {
    const timing = start(dashboard, demoProviders());
    const engine = createBoardEngine({
      dashboard,
      providers: timing.providers,
    });
    const unsubscribe = engine.subscribe(setModel);
    void engine.refreshAll();
    return () => {
      unsubscribe();
      timing.stop();
    };
  }, [dashboard, start]);
  return model;
}

describe('useDevBoardTiming', () => {
  it('reports the demo board when its last cell is committed', async () => {
    const page: PageTiming = { boardShown: false, stopped: [] };
    const reports: TimingSummary[] = [];
    renderHook(() => useTimedBoard(demoDashboard, page, reports));
    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    const [summary] = reports;
    expect(summary).toMatchObject({
      kind: 'demo',
      demoLatencyMs: 300,
      pageLoad: 'reload',
      cells: demoDashboard.rows.length * demoDashboard.stages.length,
    });
    expect(summary.firstCell).toBeDefined();
    // Every row needed requests: its repo's runs, or its app's jobs.
    expect(summary.perRow.every((r) => r.requests > 0)).toBe(true);
    expect(page.boardShown).toBe(true);
  });

  it('times a board opened later in the page from opening only', async () => {
    const page: PageTiming = { boardShown: true, stopped: [] };
    const reports: TimingSummary[] = [];
    const other = { ...demoDashboard, id: 'saved' };
    const { unmount } = renderHook(() => useTimedBoard(other, page, reports));
    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    expect(reports[0]?.pageLoad).toBeUndefined();
    expect(reports[0]?.kind).toBe('real');
    expect(reports[0]?.demoLatencyMs).toBe(0);
    unmount();
    // The closed board's session is kept to count its stray requests.
    expect(page.stopped).toHaveLength(1);
  });
});
