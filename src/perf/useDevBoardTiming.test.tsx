import { renderHook, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { Dashboard } from '@/domain/config/dashboard';
import { createBoardModel } from '@/engine';
import { emptyModel } from '@/engine/model';
import type { RequestCall } from '@/query/instrument';
import { demoEnv, FILL_TIMEOUT_MS, fullModel } from '@/test/boardModel';

import type { TimingSink } from './session';
import type { TimingSummary } from './summary';
import { TIMING_NAMES } from './targets';
import {
  type DevTimingOptions,
  type PageTiming,
  useDevBoardTiming,
} from './useDevBoardTiming';

/** How long the demo board may take to fill at its simulated latency,
 * with the whole suite running alongside. */
/** A request of the demo's GitHub token. */
const runsCall: RequestCall = {
  provider: 'github',
  kind: 'runs',
  credentialId: 'demo-github',
  repo: 'acme/api-core',
};

/** A board like `useBoardModel`'s: each mount times its own model. */
function useTimedBoard(dashboard: Dashboard, options: DevTimingOptions) {
  const [model, setModel] = useState(emptyModel);
  const start = useDevBoardTiming(model, options);
  useEffect(() => {
    const timing = start(dashboard);
    const env = demoEnv();
    env.setAround(timing.around);
    const board = createBoardModel({ dashboard, env });
    const unsubscribe = board.subscribe(() => {
      setModel(board.getModel());
    });
    return () => {
      unsubscribe();
      board.destroy();
      timing.stop();
    };
  }, [dashboard, start]);
  return model;
}

/** Overrides that capture reports instead of writing to the browser. */
const capturing = (
  page: PageTiming,
  reports: TimingSummary[],
): DevTimingOptions => ({
  page,
  search: () => '?latency=300',
  sink: (): TimingSink => ({
    mark: () => undefined,
    measure: () => undefined,
    report: (s) => reports.push(s),
  }),
});

describe('useDevBoardTiming', () => {
  it('reports the demo board when its last cell is committed', async () => {
    const page: PageTiming = { boardShown: false, stopped: [] };
    const reports: TimingSummary[] = [];
    renderHook(() =>
      useTimedBoard(measureBoard, {
        ...capturing(page, reports),
        navigation: () => 'reload',
      }),
    );
    await waitFor(
      () => {
        expect(reports).toHaveLength(1);
      },
      { timeout: FILL_TIMEOUT_MS },
    );
    const [summary] = reports;
    expect(summary).toMatchObject({
      kind: 'demo',
      demoLatencyMs: 300,
      pageLoad: 'reload',
      cells: measureBoard.rows.length * measureBoard.stages.length,
    });
    expect(summary.firstCell).toBeDefined();
    // Every row needed requests: its repo's runs, or its app's jobs.
    expect(summary.perRow.every((r) => r.requests > 0)).toBe(true);
    expect(page.boardShown).toBe(true);
  });

  it('times a board opened later in the page from opening only', async () => {
    const page: PageTiming = { boardShown: true, stopped: [] };
    const reports: TimingSummary[] = [];
    const other = { ...measureBoard, id: 'saved' };
    const { unmount } = renderHook(() =>
      useTimedBoard(other, capturing(page, reports)),
    );
    await waitFor(
      () => {
        expect(reports).toHaveLength(1);
      },
      { timeout: FILL_TIMEOUT_MS },
    );
    expect(reports[0]?.pageLoad).toBeUndefined();
    expect(reports[0]?.kind).toBe('real');
    expect(reports[0]?.demoLatencyMs).toBe(0);
    unmount();
    // The closed board's session is kept to count its stray requests.
    expect(page.stopped).toHaveLength(1);
  });

  it('keeps timing the new board when an older one closes after it opened', async () => {
    const page: PageTiming = { boardShown: true, stopped: [] };
    const reports: TimingSummary[] = [];
    const { result, rerender } = renderHook(
      ({ model }) => useDevBoardTiming(model, capturing(page, reports)),
      { initialProps: { model: emptyModel() } },
    );
    const older = result.current(measureBoard);
    result.current(measureBoard);
    older.stop();
    rerender({ model: await fullModel(measureBoard) });
    // The newer session still receives commits and reports its board.
    expect(reports).toHaveLength(1);
  });

  it("counts a closed board's polling that settles later as stray for the next", async () => {
    const page: PageTiming = { boardShown: true, stopped: [] };
    const reports: TimingSummary[] = [];
    let now = 0;
    const { result, rerender } = renderHook(
      ({ model }) =>
        useDevBoardTiming(model, {
          ...capturing(page, reports),
          clock: () => (now += 1),
        }),
      { initialProps: { model: emptyModel() } },
    );
    // A poll of the first board that is still running when it closes.
    let settle: () => void = () => undefined;
    const polled = new Promise<never[]>((resolve) => {
      settle = () => {
        resolve([]);
      };
    });
    const full = await fullModel(measureBoard);

    const first = result.current(measureBoard);
    await first.around(runsCall, () => Promise.resolve([]));
    rerender({ model: full });
    expect(reports).toHaveLength(1);
    const poll = first.around({ ...runsCall, kind: 'repos' }, () => polled);
    first.stop();
    result.current(measureBoard);
    settle();
    await poll;
    rerender({ model: { ...full } });

    expect(reports).toHaveLength(2);
    // Stray for the second board, and not part of the first board's load.
    expect(reports[1]?.notes).toContainEqual(
      expect.stringMatching(/^1 requests ran meanwhile/),
    );
    expect(reports[0]?.requests.total).toBe(1);
    expect(page.stopped[0]?.requests()).toHaveLength(1);
  });

  describe('with the browser defaults', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      window.history.pushState({}, '', '/');
      performance.clearMarks();
      performance.clearMeasures();
    });

    it('reads the latency from the URL and reports to User Timing and the console', async () => {
      window.history.pushState({}, '', '/demo?latency=300');
      const headlines: string[] = [];
      vi.spyOn(console, 'groupCollapsed').mockImplementation((text) => {
        headlines.push(String(text));
      });
      vi.spyOn(console, 'info').mockImplementation(() => undefined);
      vi.spyOn(console, 'table').mockImplementation(() => undefined);
      vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      // Only the page state is injected: clock, URL, navigation entry and
      // sink are the browser's.
      renderHook(() =>
        useTimedBoard(measureBoard, {
          page: { boardShown: false, stopped: [] },
        }),
      );
      await waitFor(
        () => {
          expect(headlines).toHaveLength(1);
        },
        { timeout: FILL_TIMEOUT_MS },
      );
      // A page with no navigation entry counts as a fresh navigation.
      expect(headlines[0]).toContain('from page navigate');
      expect(headlines[0]).toContain('(demo,');
      const [full] = performance.getEntriesByName(
        TIMING_NAMES.fullBoard,
        'measure',
      );
      expect(full).toBeInstanceOf(PerformanceMeasure);
      expect(full instanceof PerformanceMeasure && full.detail).toMatchObject({
        kind: 'demo',
        demoLatencyMs: 300,
        pageLoad: 'navigate',
      });
      expect(
        performance.getEntriesByName(TIMING_NAMES.firstCell, 'mark'),
      ).toHaveLength(1);
    });

    it('reads how the page loaded from its navigation entry', async () => {
      const navigation = {
        entryType: 'navigation',
        type: 'reload',
        name: '',
        startTime: 0,
        duration: 0,
        toJSON: () => ({}),
      } satisfies PerformanceEntry & { type: string };
      const real = performance.getEntriesByType.bind(performance);
      vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) =>
        type === 'navigation' ? [navigation] : real(type),
      );
      const reports: TimingSummary[] = [];
      const page: PageTiming = { boardShown: false, stopped: [] };
      // No `navigation` override: the hook reads the entry above.
      renderHook(() => useTimedBoard(measureBoard, capturing(page, reports)));
      await waitFor(
        () => {
          expect(reports).toHaveLength(1);
        },
        { timeout: FILL_TIMEOUT_MS },
      );
      expect(reports[0]?.pageLoad).toBe('reload');
    });
  });
});
