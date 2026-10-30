/**
 * A demo board with one Amplify row found by repo, read through the
 * simulator's providers with its opt-in regions answering as a test
 * chooses, and that environment's cache as the persister keeps it,
 * restored into a fresh one (a reload).
 *
 * @module
 */
import { dehydrate, hydrate } from '@tanstack/query-core';

import { measureBoard } from '@/demo/scenarios/measure';
import type { Wait } from '@/demo/sim/simulator';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyReader } from '@/lib/amplify/reader';
import { OPT_IN_REGIONS } from '@/lib/amplify/regions';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import { QueryKeySchema } from '@/query/keys';

import { withoutRetryDelay } from './boardModel';
import { simProviders, simTransport } from './simDemo';

/** The row found by repo. */
export const FOUND = 'marketing-site';

/** The demo board with `FOUND` found by repo, the other rows pinned. */
export const foundByRepoDashboard: Dashboard = {
  ...measureBoard,
  rows: measureBoard.rows.map((row) =>
    row.id === FOUND && row.type === 'amplify'
      ? { ...row, pinnedApps: [] }
      : row,
  ),
};

/** How a test's opt-in regions answer: a reader for each. */
export type OptInReader = (region: string) => AmplifyReader;

/** The simulator's providers, with each opt-in region's reader from
 * `optIn`; `wait` is the simulator's. */
export const foundByRepoEnv = (optIn: OptInReader, wait?: Wait): QueryEnv =>
  withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => {
        const sim = simProviders(
          hooks,
          simTransport(() => 0, wait ? { wait } : {}),
        );
        return {
          ...sim,
          amplify: (id) => {
            const readerFor = sim.amplify(id);
            return (
              readerFor &&
              ((at) =>
                OPT_IN_REGIONS.has(at.region)
                  ? optIn(at.region)
                  : readerFor(at))
            );
          },
        };
      },
    }),
  );

/** `env`'s cache as the persister keeps it (successful queries only),
 * restored into `next`. */
export function reloadInto(env: QueryEnv, next: QueryEnv): QueryEnv {
  hydrate(
    next.client,
    dehydrate(env.client, {
      shouldDehydrateQuery: (query) => query.state.status === 'success',
    }),
  );
  return next;
}

/** How many of `env`'s app searches (Amplify `apps` reads) are fetching.
 * A reload reads every row's roots (an app's branches and their jobs)
 * again at once, the first poll (Decision 109), but not the searches it
 * restored. */
export const searchesFetching = (env: QueryEnv): number =>
  env.client.isFetching({
    predicate: ({ queryKey }) => {
      const key = QueryKeySchema.safeParse(queryKey);
      return (
        key.success && key.data[0] === 'amplify' && key.data[2].call === 'apps'
      );
    },
  });
