/**
 * Development aid (spec.md §3.5): the board's timing hook. Each board
 * model the board starts gets a timing session around every request the
 * query layer sends; a layout
 * effect tells the session when a model is committed to the DOM, so the
 * first cell and the full board are timed as the user sees them. Only
 * development builds use it (see `index.ts`).
 *
 * @module
 */
import { useCallback, useLayoutEffect, useRef } from 'react';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine/types';
import type { Around } from '@/query/instrument';

import { browserSink } from './consoleSink';
import { demoLatencyMs } from './demoLatency';
import {
  createTimingSession,
  type TimingSession,
  type TimingSink,
} from './session';

/** One board's timing: around each request, and the end of its board. */
interface BoardTiming {
  around: Around;
  stop(): void;
}

/** Starts timing a board model for `dashboard`. */
export type StartTiming = (dashboard: Dashboard) => BoardTiming;

/** Stopped sessions kept to count requests still running for them. */
const STOPPED_SESSIONS_KEPT = 4;

/** What the page has seen, across boards. */
export interface PageTiming {
  /** Has a board been shown in full since the page loaded? */
  boardShown: boolean;
  /** Sessions whose boards closed, newest last. */
  stopped: TimingSession[];
}

/** The page's timing state in the app (tests pass their own). */
const sharedPage: PageTiming = { boardShown: false, stopped: [] };

/** How a page loaded when the browser gives no navigation entry. */
const DEFAULT_NAVIGATION = 'navigate';

/** How the page loaded (`navigate`, `reload`, `back_forward`). Read
 * structurally: `PerformanceNavigationTiming` isn't defined everywhere. */
function navigationType(): string {
  const entry = performance.getEntriesByType('navigation').at(0);
  return entry !== undefined &&
    'type' in entry &&
    typeof entry.type === 'string'
    ? entry.type
    : DEFAULT_NAVIGATION;
}

/** Requests that settled after `since` for boards no longer shown. */
const strayAfter = (page: PageTiming, since: number): number =>
  page.stopped.flatMap((s) => s.settled()).filter((end) => end > since).length;

/** Overrides of the browser's page state, sink and clock, for tests. */
export interface DevTimingOptions {
  page?: PageTiming;
  sink?: (dashboard: Dashboard) => TimingSink;
  clock?: () => number;
  search?: () => string;
  navigation?: () => string;
}

/** Time each board model the board starts (development builds). */
export function useDevBoardTiming(
  model: BoardModel,
  options: DevTimingOptions = {},
): StartTiming {
  const current = useRef<TimingSession | undefined>(undefined);
  const settings = useRef(options);

  useLayoutEffect(() => {
    current.current?.committed(model);
  }, [model]);

  return useCallback((dashboard) => {
    const {
      page = sharedPage,
      clock = () => performance.now(),
      search = () => window.location.search,
      navigation = navigationType,
      sink = (d: Dashboard) =>
        browserSink(
          Object.fromEntries(d.rows.map((r) => [r.id, r.displayName])),
        ),
    } = settings.current;
    const opened = clock();
    const inner = sink(dashboard);
    const session = createTimingSession({
      dashboard,
      // The demo's latency comes from its URL (`?latency=300`).
      kind: dashboard.id === demoDashboard.id ? 'demo' : 'real',
      demoLatencyMs:
        dashboard.id === demoDashboard.id ? demoLatencyMs(search()) : 0,
      ...(page.boardShown ? {} : { pageLoad: navigation() }),
      clock,
      sink: {
        ...inner,
        report: (summary) => {
          page.boardShown = true;
          inner.report(summary);
        },
      },
      strayRequests: () => strayAfter(page, opened),
    });
    current.current = session;
    return {
      around: session.around,
      stop: () => {
        session.stop();
        page.stopped = [...page.stopped, session].slice(-STOPPED_SESSIONS_KEPT);
        if (current.current === session) current.current = undefined;
      },
    };
  }, []);
}
