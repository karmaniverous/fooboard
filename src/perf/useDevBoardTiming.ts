/**
 * Development aid (spec.md §3.5): the board's timing hook. Each engine the
 * board starts gets a timing session wrapping its providers; a layout
 * effect tells the session when a model is committed to the DOM, so the
 * first cell and the full board are timed as the user sees them. Only
 * development builds use it (see `index.ts`).
 *
 * @module
 */
import { useCallback, useLayoutEffect, useRef } from 'react';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel, EngineProviders } from '@/engine/types';

import { browserSink } from './consoleSink';
import { demoLatencyMs } from './demoLatency';
import { wrapProviders } from './readerWrap';
import {
  createTimingSession,
  type TimingSession,
  type TimingSink,
} from './session';

/** One engine's timing: its wrapped providers, and the end of its board. */
interface BoardTiming {
  providers: EngineProviders;
  stop(): void;
}

/** Starts timing an engine for `dashboard` reading through `providers`. */
export type StartTiming = (
  dashboard: Dashboard,
  providers: EngineProviders,
) => BoardTiming;

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

/** How the page loaded (`navigate`, `reload`, `back_forward`). */
function navigationType(): string {
  const [entry] = performance.getEntriesByType('navigation');
  return entry instanceof PerformanceNavigationTiming ? entry.type : 'navigate';
}

/** Requests that settled after `since` for boards no longer shown. */
const strayAfter = (page: PageTiming, since: number): number =>
  page.stopped.flatMap((s) => s.requests()).filter((r) => r.end > since).length;

/** Overrides of the browser's page state, sink and clock, for tests. */
export interface DevTimingOptions {
  page?: PageTiming;
  sink?: (dashboard: Dashboard) => TimingSink;
  clock?: () => number;
  search?: () => string;
  navigation?: () => string;
}

/** Time each engine the board starts (development builds). */
export function useDevBoardTiming(
  model: BoardModel,
  options: DevTimingOptions = {},
): StartTiming {
  const current = useRef<TimingSession | undefined>(undefined);
  const settings = useRef(options);

  useLayoutEffect(() => {
    current.current?.committed(model);
  }, [model]);

  return useCallback((dashboard, providers) => {
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
      providers: wrapProviders(providers, session.around),
      stop: () => {
        session.stop();
        page.stopped = [...page.stopped, session].slice(-STOPPED_SESSIONS_KEPT);
        if (current.current === session) current.current = undefined;
      },
    };
  }, []);
}
