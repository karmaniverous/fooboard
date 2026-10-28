/**
 * Board model test helpers: a demo query environment over the simulator
 * (retries without delay, the clock frozen at the scenario's opening
 * unless given, delays resolving at once unless a `wait` is given), the
 * model once every query it needs has landed, and an age past every poll
 * interval.
 *
 * @module
 */
import { vi } from 'vitest';

import type { DemoScenario } from '@/demo/sim/scenario';
import type { Wait } from '@/demo/sim/simulator';
import type { Dashboard } from '@/domain/config/dashboard';
import { createBoardModel } from '@/engine';
import type { BoardModelHandle } from '@/engine/boardModel';
import type { BoardModel } from '@/engine/types';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import { BUDGET_BACKOFF, IDLE_INTERVAL_MS } from '@/query/intervals';

import { simProviders, simTransport } from './simDemo';

/** Longer than any root query's poll interval. */
export const OVERDUE_MS = IDLE_INTERVAL_MS * BUDGET_BACKOFF + 1;

/** Freeze the clock (`Date` only; timeouts stay real, so `settle` still
 * runs) at a fixed instant, and return it. A test that reads the
 * *refreshing* mark freezes it before filling a board, so the data can't
 * age while the board fills; it restores real timers afterwards. */
export function freezeDate(): number {
  const instant = FROZEN_AT;
  vi.useFakeTimers({ toFake: ['Date'], now: instant });
  return instant;
}

/** The instant `freezeDate` holds the clock at. */
const FROZEN_AT = Date.UTC(2026, 0, 1);

/** How long a test waits for a demo board to fill. */
export const FILL_TIMEOUT_MS = 10_000;

/** Retries in tests wait nothing. */
export function withoutRetryDelay(env: QueryEnv): QueryEnv {
  env.client.setDefaultOptions({
    queries: { ...env.client.getDefaultOptions().queries, retryDelay: 0 },
  });
  return env;
}

/** A demo query environment over `scenario` (the measurement one
 * unless given); its clock (ms from the opening) stands still by
 * default. */
export const demoEnv = (
  clock: () => number = () => 0,
  wait?: Wait,
  scenario?: DemoScenario,
): QueryEnv =>
  withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) =>
        simProviders(
          hooks,
          simTransport(clock, wait ? { wait } : {}, scenario),
          scenario,
        ),
    }),
  );

/** Resolve once nothing is fetching and the model has re-derived. */
export async function settle(
  env: QueryEnv,
  board: BoardModelHandle,
): Promise<BoardModel> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (env.client.isFetching() === 0) {
      await Promise.resolve();
      if (env.client.isFetching() === 0) return board.getModel();
    }
  }
}

/** `dashboard`'s board model once fully read through `env`. */
export async function fullModel(
  dashboard: Dashboard,
  env: QueryEnv = demoEnv(),
): Promise<BoardModel> {
  const board = createBoardModel({ dashboard, env });
  try {
    return await settle(env, board);
  } finally {
    board.destroy();
  }
}
