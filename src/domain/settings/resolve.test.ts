/**
 * Tests for the settings resolver (spec.md §3.11, Decision 51): each tier
 * of the fixed lattice wins over the ones below it, the home axis wins a
 * tie at the row/column and group tiers (the column for the AWS key, the
 * row for the rest), the first level that sets a value wins outright, and
 * the built-in applies when none does. Also what a place inherits and
 * which more specific places win over it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { all, is } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';

import { setSettings, settingsAt, type SettingsPlace } from './places';
import { inheritedAt, resolveSetting, rowSetting, shadowsAt } from './resolve';
import { type SettingField, type Settings, writeSetting } from './schema';

const ids = ['dash', 'rg', 'cg', 'row', 'col', 'cell'];
const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  credentials: ids.flatMap((id) => [
    { id: `gh-${id}`, kind: 'github', label: id },
    { id: `aws-${id}`, kind: 'aws', label: id },
  ]),
  stages: [
    { id: 'dev', name: 'Dev' },
    { id: 'prod', name: 'Prod' },
  ],
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
    },
    { type: 'github', id: 'solo', repo: 'acme/solo', displayName: 'solo' },
  ],
  rowGroups: [{ id: 'rg', memberIds: ['api', 'site'] }],
  columnGroups: [{ id: 'cg', memberIds: ['prod'] }],
});
const api = base.rows[0];
const site = base.rows[1];

const PLACES: Record<string, SettingsPlace> = {
  dash: { level: 'dashboard' },
  rg: { level: 'rowGroup', groupId: 'rg' },
  cg: { level: 'columnGroup', groupId: 'cg' },
  row: { level: 'row', rowId: 'site' },
  col: { level: 'column', stageId: 'prod' },
  cell: { level: 'cell', rowId: 'site', stageId: 'prod' },
};

/** `d` with `field` set to `value` (for Amplify rows) at each of `at`. */
function setting<F extends SettingField>(
  field: F,
  at: readonly string[],
  value: (id: string) => Parameters<typeof writeSetting<F>>[3],
  d: Dashboard = base,
): Dashboard {
  return at.reduce((out, id) => {
    const place = PLACES[id];
    return setSettings(
      out,
      place,
      writeSetting(settingsAt(out, place) ?? {}, field, 'amplify', value(id)),
    );
  }, d);
}

const awsAt = (...at: string[]) => setting('awsKey', at, (id) => `aws-${id}`);
const setAt = (...at: string[]) =>
  setting('statusSets', at, (id) => `set-${id}`);

describe('resolveSetting', () => {
  it.each([
    [['dash', 'rg', 'cg', 'row', 'col', 'cell'], 'cell'],
    [['dash', 'rg', 'cg', 'row'], 'row'],
    [['dash', 'rg', 'cg', 'col'], 'col'],
    [['dash', 'rg'], 'rg'],
    [['dash', 'cg'], 'cg'],
    [['dash'], 'dash'],
  ])('takes the most specific tier setting it: %j -> %s', (at, winner) => {
    const resolved = resolveSetting(awsAt(...at), site, 'prod', 'awsKey');
    expect(resolved).toEqual({
      value: `aws-${winner}`,
      origin: PLACES[winner],
    });
  });

  it('gives the AWS key to the column, its home axis, when both axes set it', () => {
    expect(
      resolveSetting(awsAt('row', 'col'), site, 'prod', 'awsKey').origin,
    ).toEqual(PLACES.col);
    expect(
      resolveSetting(awsAt('rg', 'cg'), site, 'prod', 'awsKey').origin,
    ).toEqual(PLACES.cg);
  });

  it.each<[SettingField, (id: string) => Settings]>([
    ['githubToken', (id) => ({ githubToken: `gh-${id}` })],
    ['statusSets', (id) => ({ statusSets: { amplify: `set-${id}` } })],
    ['itemRules', (id) => ({ itemRules: { amplify: all(is('$.name', id)) } })],
  ])(
    'gives %s to the row, its home axis, when both axes set it',
    (field, at) => {
      const tie = (ids: string[]) =>
        resolveSetting(
          ids.reduce((out, id) => setSettings(out, PLACES[id], at(id)), base),
          site,
          'prod',
          field,
        ).origin;
      expect(tie(['row', 'col'])).toEqual(PLACES.row);
      expect(tie(['rg', 'cg'])).toEqual(PLACES.rg);
    },
  );

  it('reads the column only in its own cells, and a group only for its members', () => {
    const d = awsAt('col', 'rg');
    expect(resolveSetting(d, site, 'dev', 'awsKey').origin).toEqual(PLACES.rg);
    const solo = d.rows[2];
    expect(
      resolveSetting(d, { ...solo, type: 'amplify' }, 'dev', 'awsKey'),
    ).toEqual({
      value: undefined,
      origin: { level: 'builtIn' },
    });
  });

  it("reads a per-source field for the row's own source only", () => {
    const d = setAt('dash');
    expect(resolveSetting(d, site, 'dev', 'statusSets').value).toBe('set-dash');
    expect(resolveSetting(d, api, 'dev', 'statusSets')).toEqual({
      value: 'github-deploy-test',
      origin: { level: 'builtIn' },
    });
  });

  it.each([
    ['githubToken', undefined],
    ['awsKey', undefined],
    ['statusSets', 'amplify'],
    ['itemRules', always],
  ] as const)('falls back to the built-in %s', (field, value) => {
    expect(resolveSetting(base, site, 'dev', field)).toEqual({
      value,
      origin: { level: 'builtIn' },
    });
  });
});

describe('inheritedAt', () => {
  const d = awsAt('dash', 'rg', 'cg', 'row', 'col', 'cell');
  it.each([
    ['dash', { level: 'builtIn' }],
    ['rg', PLACES.dash],
    ['cg', PLACES.dash],
    // A row leaves the columns out, a column the rows.
    ['row', PLACES.rg],
    ['col', PLACES.cg],
    // A cell walks the whole lattice: the column wins its home tie.
    ['cell', PLACES.col],
  ])('gives %s what the level above it sets', (id, origin) => {
    expect(inheritedAt(d, PLACES[id], 'awsKey', 'amplify').origin).toEqual(
      origin,
    );
  });

  it('falls to the dashboard for a row or column in no group', () => {
    expect(
      inheritedAt(d, { level: 'row', rowId: 'solo' }, 'awsKey', 'amplify')
        .origin,
    ).toEqual(PLACES.dash);
    expect(
      inheritedAt(d, { level: 'column', stageId: 'dev' }, 'awsKey', 'amplify')
        .origin,
    ).toEqual(PLACES.dash);
  });
});

describe('rowSetting', () => {
  it("reads the row's own, else its group's, without columns", () => {
    expect(rowSetting(awsAt('rg', 'col'), site, 'awsKey').origin).toEqual(
      PLACES.rg,
    );
    expect(rowSetting(awsAt('rg', 'row'), site, 'awsKey').origin).toEqual(
      PLACES.row,
    );
  });
});

describe('shadowsAt', () => {
  it('lists only what spans every row or column over a missing group', () => {
    const d = awsAt('row', 'col');
    expect(
      shadowsAt(d, { level: 'rowGroup', groupId: 'gone' }, 'awsKey', 'amplify'),
    ).toEqual([PLACES.col]);
    expect(
      shadowsAt(
        d,
        { level: 'columnGroup', groupId: 'gone' },
        'awsKey',
        'amplify',
      ),
    ).toEqual([PLACES.row]);
  });

  it('lists nothing over the dashboard or a cell', () => {
    const d = awsAt('dash', 'rg', 'cg', 'row', 'col', 'cell');
    expect(shadowsAt(d, PLACES.dash, 'awsKey', 'amplify')).toEqual([]);
    expect(shadowsAt(d, PLACES.cell, 'awsKey', 'amplify')).toEqual([]);
  });

  it("lists a row's cells, and for the AWS key the columns setting it", () => {
    const d = awsAt('row', 'col', 'cell');
    expect(shadowsAt(d, PLACES.row, 'awsKey', 'amplify')).toEqual([
      PLACES.cell,
      PLACES.col,
    ]);
    const s = setAt('row', 'col', 'cell');
    expect(shadowsAt(s, PLACES.row, 'statusSets', 'amplify')).toEqual([
      PLACES.cell,
    ]);
  });

  it("lists a column's cells, and for a row-home field the rows setting it", () => {
    const s = setAt('row', 'col', 'cell');
    expect(shadowsAt(s, PLACES.col, 'statusSets', 'amplify')).toEqual([
      PLACES.cell,
      PLACES.row,
    ]);
    expect(
      shadowsAt(awsAt('row', 'col', 'cell'), PLACES.col, 'awsKey', 'amplify'),
    ).toEqual([PLACES.cell]);
  });

  it("lists a row group's rows, cells, every column, and for the AWS key the column groups", () => {
    const d = awsAt('rg', 'cg', 'row', 'col', 'cell');
    expect(shadowsAt(d, PLACES.rg, 'awsKey', 'amplify')).toEqual([
      PLACES.row,
      PLACES.cell,
      PLACES.col,
      PLACES.cg,
    ]);
    const s = setAt('rg', 'cg', 'row', 'col', 'cell');
    expect(shadowsAt(s, PLACES.rg, 'statusSets', 'amplify')).toEqual([
      PLACES.row,
      PLACES.cell,
      PLACES.col,
    ]);
  });

  it("lists a column group's columns, cells, every row, and for a row-home field the row groups", () => {
    const s = setAt('rg', 'cg', 'row', 'col', 'cell');
    expect(shadowsAt(s, PLACES.cg, 'statusSets', 'amplify')).toEqual([
      PLACES.col,
      PLACES.cell,
      PLACES.row,
      PLACES.rg,
    ]);
    const d = awsAt('rg', 'cg', 'row', 'col', 'cell');
    expect(shadowsAt(d, PLACES.cg, 'awsKey', 'amplify')).toEqual([
      PLACES.col,
      PLACES.cell,
      PLACES.row,
    ]);
  });

  it('counts only rows of the source for a per-source field', () => {
    const s = setting('statusSets', ['row'], () => 'x');
    const onApi = setSettings(
      s,
      { level: 'row', rowId: 'api' },
      {
        statusSets: { github: 'y' },
      },
    );
    expect(shadowsAt(onApi, PLACES.dash, 'statusSets', 'amplify')).toEqual([]);
    expect(shadowsAt(onApi, PLACES.rg, 'statusSets', 'amplify')).toEqual([
      PLACES.row,
    ]);
    expect(
      shadowsAt(onApi, PLACES.rg, 'statusSets', 'github').map((p) => p.level),
    ).toEqual(['row']);
  });
});
