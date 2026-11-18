/**
 * When a row's root queries last completed a fetch (spec 0.2.0 §3.H,
 * spec §3.L): the clock a boost's steps and a hidden row's ramp both step
 * on. A step ends when every root query the row needs has completed a
 * fetch (with data or an error) since the step began, so a row's interval
 * changes only when one of its polls completes, never between polls
 * (TanStack restarts a query's interval timer whenever its interval
 * changes). Pure but for the cache reader `rootCompletions`.
 *
 * @module
 */
import { hashKey, type QueryClient } from '@tanstack/query-core';

import type { Need } from './need';

/** When each root query of a row last completed a fetch (ms; 0: never),
 * by query hash. */
export type Completions = ReadonlyMap<string, number>;

/** When `hash`'s query last completed a fetch (0: never). */
const completedAt = (client: QueryClient, hash: string): number => {
  const state = client.getQueryCache().get(hash)?.state;
  return state ? Math.max(state.dataUpdatedAt, state.errorUpdatedAt) : 0;
};

/** The completions of the root queries among `needs`. */
export const rootCompletions = (
  client: QueryClient,
  needs: readonly Need[],
): Completions =>
  new Map(
    needs
      .filter((need) => need.root)
      .map((need) => {
        const hash = hashKey(need.key);
        return [hash, completedAt(client, hash)];
      }),
  );

/**
 * Has every root query in `completions` completed a fetch since a step
 * that began at `stepStartedAt`, when they stood at `baseline`? A query
 * the baseline doesn't know must have completed after the step began. A
 * row with no root queries never steps.
 */
export const polledSince = (
  completions: Completions,
  baseline: Completions,
  stepStartedAt: number,
): boolean =>
  completions.size > 0 &&
  [...completions].every(
    ([hash, completed]) => completed > (baseline.get(hash) ?? stepStartedAt),
  );
