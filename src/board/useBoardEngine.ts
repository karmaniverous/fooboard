/**
 * React binding for the board engine (spec.md §8 step 7): creates the
 * engine for a dashboard, starts polling while mounted, and re-renders on
 * every published model. Also ticks a clock once a minute so relative
 * times stay current between refreshes. In development builds each
 * engine is timed (spec.md §3.5, `src/perf`).
 *
 * @module
 */
import { useEffect, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import {
  type BoardModel,
  createBoardEngine,
  emptyModel,
  type EngineProviders,
  githubCredentialIds,
} from '@/engine';
import { IDLE_INTERVAL_MS } from '@/engine/scheduler';
import { useBoardTiming } from '@/perf';

export function useBoardEngine(
  dashboard: Dashboard,
  providers: EngineProviders,
): { model: BoardModel; now: number } {
  // Every token's battery from the first render (C-16), and again at once
  // for a changed dashboard, before its engine publishes.
  const [model, setModel] = useState<BoardModel>(() =>
    emptyModel(githubCredentialIds(dashboard)),
  );
  const [seen, setSeen] = useState(dashboard);
  if (seen !== dashboard) {
    setSeen(dashboard);
    setModel(emptyModel(githubCredentialIds(dashboard)));
  }
  const [now, setNow] = useState(() => Date.now());
  const startTiming = useBoardTiming(model);

  useEffect(() => {
    const timing = startTiming(dashboard, providers);
    const engine = createBoardEngine({
      dashboard,
      providers: timing.providers,
    });
    const unsubscribe = engine.subscribe((next) => {
      setModel(next);
      setNow(Date.now());
    });
    engine.start();
    return () => {
      unsubscribe();
      engine.stop();
      timing.stop();
    };
  }, [dashboard, providers, startTiming]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      // Relative times read in minutes; between refreshes, tick at the
      // idle polling interval (one minute).
    }, IDLE_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  return { model, now };
}
