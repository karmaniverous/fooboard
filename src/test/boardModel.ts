/**
 * Board model test helpers: a demo query environment (retries without
 * delay, the demo clock frozen unless given), and the model once every
 * query it needs has landed.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { createBoardModel, demoProviders } from '@/engine';
import type { BoardModelHandle } from '@/engine/boardModel';
import type { BoardModel } from '@/engine/types';
import { createQueryEnv, type QueryEnv } from '@/query/client';

/** How long a test waits for a demo board to fill. */
export const FILL_TIMEOUT_MS = 10_000;

/** Retries in tests wait nothing. */
export function withoutRetryDelay(env: QueryEnv): QueryEnv {
  env.client.setDefaultOptions({
    queries: { ...env.client.getDefaultOptions().queries, retryDelay: 0 },
  });
  return env;
}

/** A demo query environment; the demo clock stands still by default. */
export const demoEnv = (clock: () => number = () => 0): QueryEnv =>
  withoutRetryDelay(
    createQueryEnv({ providers: (hooks) => demoProviders(hooks, clock) }),
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
