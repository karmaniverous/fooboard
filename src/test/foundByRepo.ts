/**
 * A demo board with one Amplify row found by repo, read through the demo's
 * providers with its listings naming each app's repo and its opt-in
 * regions answering as a test chooses, and that environment's cache as
 * the persister keeps it, restored into a fresh one (a reload).
 *
 * @module
 */
import { dehydrate, hydrate } from '@tanstack/query-core';

import type { Wait } from '@/demo/addedRun';
import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { demoProviders } from '@/engine/demoProviders';
import type { AmplifyReader } from '@/lib/amplify/reader';
import { OPT_IN_REGIONS } from '@/lib/amplify/regions';
import { createQueryEnv, type QueryEnv } from '@/query/client';

import { withoutRetryDelay } from './boardModel';

/** The row found by repo. */
export const FOUND = 'marketing-site';

/** The demo board with `FOUND` found by repo, the other rows pinned. */
export const foundByRepoDashboard: Dashboard = {
  ...demoDashboard,
  rows: demoDashboard.rows.map((row) =>
    row.id === FOUND && row.type === 'amplify'
      ? { ...row, pinnedApps: [] }
      : row,
  ),
};

/** How a test's opt-in regions answer: a reader for each. */
export type OptInReader = (region: string) => AmplifyReader;

/** The demo's providers, its listings naming each app's repo, and each
 * opt-in region's reader from `optIn`; `wait` is the demo's. */
export const foundByRepoEnv = (optIn: OptInReader, wait?: Wait): QueryEnv =>
  withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => {
        const demo = demoProviders(hooks, () => 0, wait);
        return {
          ...demo,
          amplify: (id) => {
            const readerFor = demo.amplify(id);
            return (
              readerFor &&
              ((at) => {
                if (OPT_IN_REGIONS.has(at.region)) return optIn(at.region);
                const reader = readerFor(at);
                return {
                  ...reader,
                  listApps: async () =>
                    (await reader.listApps()).map((app) => ({
                      ...app,
                      repository: `https://github.com/acme/${app.name ?? ''}`,
                    })),
                };
              })
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
