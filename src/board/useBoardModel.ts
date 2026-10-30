/**
 * React binding for the board model (spec.md §3.1): creates the model for
 * the query environment while mounted, hands it each edited dashboard
 * (re-derived from the cache at once, so the board never blanks), and
 * re-renders on every published model. Also ticks a clock once a minute
 * so relative times stay current. In development builds each board model
 * is timed (spec.md §3.5, `src/perf`). `attend` boosts rows' polling
 * through the live model (spec 0.2.0 §3.H), and does nothing between
 * models.
 *
 * @module
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import {
  type BoardModel,
  type BoardModelHandle,
  createBoardModel,
  emptyModel,
  githubCredentialIds,
} from '@/engine';
import { useBoardTiming } from '@/perf';
import type { QueryEnv } from '@/query/client';
import type { Around } from '@/query/instrument';
import { type BoostKind, IDLE_INTERVAL_MS } from '@/query/intervals';

/** `outer` around `inner` (either may be absent). */
const compose =
  (outer: Around, inner: Around | undefined): Around =>
  (call, run) =>
    outer(call, inner ? () => inner(call, run) : run);

export function useBoardModel(
  dashboard: Dashboard,
  env: QueryEnv,
  {
    around,
    refreshKey,
  }: {
    /** Wraps every request (the demo's simulated latency). */
    around?: Around;
    /** A new value re-derives every row (a secret changed). */
    refreshKey?: unknown;
  } = {},
): {
  model: BoardModel;
  now: number;
  /** Boost `rowIds`' polling for the user's `kind` of interest. */
  attend: (rowIds: readonly string[], kind: BoostKind) => void;
} {
  const [model, setModel] = useState<BoardModel>(() =>
    emptyModel(githubCredentialIds(dashboard)),
  );
  const [now, setNow] = useState(() => Date.now());
  const startTiming = useBoardTiming(model);
  const handle = useRef<BoardModelHandle | undefined>(undefined);
  const latest = useRef(dashboard);
  useEffect(() => {
    latest.current = dashboard;
  }, [dashboard]);

  useEffect(() => {
    const timing = startTiming(latest.current);
    env.setAround(compose(timing.around, around));
    const board = createBoardModel({ dashboard: latest.current, env });
    handle.current = board;
    setModel(board.getModel());
    const unsubscribe = board.subscribe(() => {
      setModel(board.getModel());
      setNow(Date.now());
    });
    return () => {
      unsubscribe();
      board.destroy();
      timing.stop();
      env.setAround(undefined);
      handle.current = undefined;
    };
  }, [env, around, startTiming]);

  useEffect(() => {
    handle.current?.setDashboard(dashboard);
  }, [dashboard]);

  const firstRefresh = useRef(refreshKey);
  useEffect(() => {
    if (firstRefresh.current === refreshKey) return;
    firstRefresh.current = refreshKey;
    handle.current?.refresh();
  }, [refreshKey]);

  useEffect(() => {
    // Relative times read in minutes; tick at the idle interval.
    const id = setInterval(() => {
      setNow(Date.now());
    }, IDLE_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  const attend = useCallback((rowIds: readonly string[], kind: BoostKind) => {
    handle.current?.attend(rowIds, kind);
  }, []);

  return { model, now, attend };
}
