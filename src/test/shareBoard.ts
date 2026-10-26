/**
 * A dashboard for share tests that names credentials at all six settings
 * levels (dashboard, row group, column group, row, column and cell) and in
 * pinned apps: the v5 fixture migrated to v6, with a column group's, a
 * column's and a cell's credential added.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import v5Board from '@/domain/config/fixtures/v5-board.json';
import { migrate } from '@/domain/config/migrate';

/** Every credential id a dashboard names, with where it is named. */
export function namedCredentials(d: Dashboard): string[] {
  const at = (where: string, s: { githubToken?: string; awsKey?: string }) =>
    [s.githubToken, s.awsKey].flatMap((id) => (id ? [`${where}:${id}`] : []));
  return [
    ...at('dashboard', d.settings),
    ...d.rowGroups.flatMap((g) => at(`rowGroup ${g.id}`, g.settings)),
    ...d.columnGroups.flatMap((g) => at(`columnGroup ${g.id}`, g.settings)),
    ...d.rows.flatMap((r) => at(`row ${r.id}`, r.settings)),
    ...d.stages.flatMap((s) => at(`stage ${s.id}`, s.settings)),
    ...d.rows.flatMap((r) =>
      Object.entries(r.cellSettings).flatMap(([stage, s]) =>
        at(`cell ${r.id} ${stage}`, s),
      ),
    ),
    ...d.rows.flatMap((r) =>
      r.type === 'amplify'
        ? r.pinnedApps.flatMap((p) =>
            p.credentialId ? [`pin ${r.id} ${p.appId}:${p.credentialId}`] : [],
          )
        : [],
    ),
  ];
}

/** The levels a dashboard names credentials at. */
export const levelsNamed = (d: Dashboard): Set<string> =>
  new Set(namedCredentials(d).map((n) => n.split(/[ :]/)[0]));

/** The share-test dashboard (fresh each call). */
export function shareBoard(): Dashboard {
  const board = migrate(structuredClone(v5Board)).dashboards.find(
    (d) => d.id === 'northwind',
  );
  const pre = board?.columnGroups.find((g) => g.id === 'pre');
  const prod = board?.stages.find((s) => s.id === 'prod');
  const orders = board?.rows.find((r) => r.id === 'orders-api');
  if (!board || !pre || !prod || !orders)
    throw new Error('fixture shape changed');
  pre.settings = { ...pre.settings, awsKey: 'aws-stage' };
  prod.settings = { ...prod.settings, awsKey: 'aws-prod' };
  orders.cellSettings = {
    ...orders.cellSettings,
    test: { githubToken: 'gh-org' },
  };
  return board;
}
