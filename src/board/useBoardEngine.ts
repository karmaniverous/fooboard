/**
 * React binding for the board engine (spec.md §8 step 7): creates the
 * engine for a dashboard, starts polling while mounted, and re-renders on
 * every published model. Also ticks a clock once a minute so relative
 * times stay current between refreshes.
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

  useEffect(() => {
    const engine = createBoardEngine({ dashboard, providers });
    const unsubscribe = engine.subscribe((next) => {
      setModel(next);
      setNow(Date.now());
    });
    engine.start();
    return () => {
      unsubscribe();
      engine.stop();
    };
  }, [dashboard, providers]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => {
      clearInterval(id);
    };
  }, []);

  return { model, now };
}
