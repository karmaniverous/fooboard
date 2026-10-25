/**
 * Tests for reloading a board with a row found by repo (spec.md §3.4,
 * §3.5 `RELOAD_FULL_BOARD_MAX_MS`, §3.12): when the key's opt-in
 * regions reject it the way a browser reads it (a 403 without its error
 * type), the search still finishes with those regions skipped, so every
 * region's answer is kept at rest and the restored board derives the
 * found row in its first pass, like the pinned rows, with no request.
 *
 * @module
 */
import { dehydrate, hydrate } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { OPT_IN_REGIONS } from '@/lib/amplify/regions';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import { cannedReader, OPT_IN_REJECTION } from '@/test/amplifySdk';
import { settle, withoutRetryDelay } from '@/test/boardModel';

import { createBoardModel } from './boardModel';
import { demoProviders } from './demoProviders';
import { cellKey } from './types';

const FOUND = 'marketing-site';

/** The demo board with one Amplify row found by repo, the others pinned. */
const dashboard: Dashboard = {
  ...demoDashboard,
  rows: demoDashboard.rows.map((row) =>
    row.id === FOUND && row.type === 'amplify'
      ? { ...row, pinnedApps: [] }
      : row,
  ),
};

/** The demo's providers, its listings naming each app's repo, and its
 * opt-in regions answering as the real account's do in a browser. */
const realisticEnv = (): QueryEnv =>
  withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => {
        const demo = demoProviders(hooks, () => 0);
        return {
          ...demo,
          amplify: (id) => {
            const readerFor = demo.amplify(id);
            return (
              readerFor &&
              ((at) => {
                const reader = readerFor(at);
                if (OPT_IN_REGIONS.has(at.region))
                  return cannedReader(at.region, OPT_IN_REJECTION);
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
 * restored into a fresh environment. */
function reloaded(env: QueryEnv): QueryEnv {
  const next = realisticEnv();
  hydrate(
    next.client,
    dehydrate(env.client, {
      shouldDehydrateQuery: (query) => query.state.status === 'success',
    }),
  );
  return next;
}

describe('reloading a board with a row found by repo', () => {
  it('derives the found row in the first pass, as the pinned rows', async () => {
    const before = realisticEnv();
    const read = createBoardModel({ dashboard, env: before });
    const full = await settle(before, read);
    read.destroy();

    const after = reloaded(before);
    const restored = createBoardModel({ dashboard, env: after });
    const first = restored.getModel();
    // (The demo's failing GitHub repos weren't kept, so they read again.)
    const amplifyFetching = after.client.isFetching({
      queryKey: ['amplify'],
    });
    restored.destroy();

    const cellsOf = (model: typeof first, rowId: string) =>
      dashboard.stages.map((s) => model.cells[cellKey(rowId, s.id)]);
    for (const row of dashboard.rows.filter((r) => r.type === 'amplify'))
      expect(cellsOf(first, row.id).every((c) => c?.settled)).toBe(true);
    expect(cellsOf(first, FOUND)).toEqual(cellsOf(full, FOUND));
    expect(cellsOf(first, FOUND).map((c) => c?.derivation.kind)).not.toContain(
      'empty',
    );
    expect(amplifyFetching).toBe(0);
  });
});
