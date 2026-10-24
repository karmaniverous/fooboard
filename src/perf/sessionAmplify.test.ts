/**
 * Tests for attributing Amplify reads to rows (spec.md §3.4, §3.11–3.12):
 * a read is a row's when one of its cells reads that app with that key,
 * each cell's key resolving through the lattice (row over group over
 * dashboard; a column's key wins in its cells), and its pins serving it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import type { RequestCall } from '@/query/instrument';

import { rowNeeds } from './session';

/** AWS keys an Amplify cell may read with, by where they're set. */
const SOURCE_KEY = 'source-aws';
const GROUP_KEY = 'group-aws';
const DASHBOARD_KEY = 'dashboard-aws';
const COLUMN_KEY = 'column-aws';

const rowById = (id: string) => {
  const row = demoDashboard.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

describe('rowNeeds for Amplify reads', () => {
  const site = rowById('marketing-site');
  if (site.type !== 'amplify') throw new Error('marketing-site is Amplify');
  // The demo's frontends inherit their group's AWS key (demo-aws).
  const frontend = demoDashboard.rowGroups.find((g) =>
    g.memberIds.includes(site.id),
  );
  if (!frontend) throw new Error('marketing-site is in a group');
  const app = (credentialId: string): RequestCall => ({
    provider: 'amplify',
    kind: 'listJobs',
    credentialId,
    region: 'us-east-1',
    appId: 'd1demomarketing',
  });
  // The demo's pins name no key of their own.
  const inheriting: Row = site;
  /** `site` with its own AWS key, its pins keyed by it. */
  const withRowKey = (credentialId: string): Row => ({
    ...site,
    settings: { ...site.settings, awsKey: credentialId },
    pinnedApps: site.pinnedApps.map((s) => ({ ...s, credentialId })),
  });
  /** The demo board with `site` as `row`, and the keys given. */
  const board = (
    row: Row,
    keys: { group?: string; dashboard?: string; column?: string },
  ): Dashboard => ({
    ...demoDashboard,
    rows: demoDashboard.rows.map((r) => (r.id === site.id ? row : r)),
    rowGroups: demoDashboard.rowGroups.map((g) =>
      g === frontend
        ? {
            ...g,
            settings: keys.group === undefined ? {} : { awsKey: keys.group },
          }
        : g,
    ),
    stages: demoDashboard.stages.map((s, i) =>
      i === 0 && keys.column ? { ...s, settings: { awsKey: keys.column } } : s,
    ),
    settings: {
      ...demoDashboard.settings,
      ...(keys.dashboard === undefined ? {} : { awsKey: keys.dashboard }),
    },
  });
  /** Which of `keys` `row` on `dashboard` reads its app with. */
  const readsWith = (dashboard: Dashboard, row: Row) =>
    [GROUP_KEY, DASHBOARD_KEY, SOURCE_KEY, COLUMN_KEY].filter((k) =>
      rowNeeds(dashboard, row, app(k)),
    );

  it("matches the row's own key over its group's and the dashboard's", () => {
    const row = withRowKey(SOURCE_KEY);
    const dashboard = board(row, {
      group: GROUP_KEY,
      dashboard: DASHBOARD_KEY,
    });
    expect(readsWith(dashboard, row)).toEqual([SOURCE_KEY]);
  });

  it("matches the group's key over the dashboard's", () => {
    const row = inheriting;
    const dashboard = board(row, {
      group: GROUP_KEY,
      dashboard: DASHBOARD_KEY,
    });
    expect(readsWith(dashboard, row)).toEqual([GROUP_KEY]);
  });

  it("matches the dashboard's key when the group sets none", () => {
    const row = inheriting;
    expect(readsWith(board(row, { dashboard: DASHBOARD_KEY }), row)).toEqual([
      DASHBOARD_KEY,
    ]);
  });

  it('matches each key a cell reads with: a column key wins in its cells', () => {
    const row = inheriting;
    expect(
      readsWith(board(row, { group: GROUP_KEY, column: COLUMN_KEY }), row),
    ).toEqual([GROUP_KEY, COLUMN_KEY]);
  });

  it('matches no read with a key the pins serve no cell for', () => {
    const row = withRowKey(SOURCE_KEY);
    const dashboard = board(
      { ...row, settings: {} },
      { dashboard: DASHBOARD_KEY },
    );
    expect(readsWith(dashboard, { ...row, settings: {} })).toEqual([]);
  });

  it('matches no read when no level sets a key', () => {
    expect(site.pinnedApps.every((s) => s.credentialId === undefined)).toBe(
      true,
    );
    const row = inheriting;
    expect(readsWith(board(row, {}), row)).toEqual([]);
  });
});
