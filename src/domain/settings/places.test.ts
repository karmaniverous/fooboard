/**
 * Tests for settings places and the settings object: the object at each
 * of the six places, replacing it (a cell's emptied object dropped, the
 * dashboard keeping its requests in flight), every held object with its
 * path, writing one field (per-source fields keyed, emptied groups
 * dropped) and counting what is set.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { always } from '@/domain/rules/always';

import {
  heldSettings,
  mapSettings,
  setSettings,
  settingsAt,
  type SettingsPlace,
} from './places';
import { countSet, readSetting, writeSetting } from './schema';

const d = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'Dev' }],
  rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
  rowGroups: [{ id: 'rg', memberIds: ['api'] }],
  columnGroups: [{ id: 'cg', memberIds: ['dev'] }],
});
const PLACES: SettingsPlace[] = [
  { level: 'dashboard' },
  { level: 'rowGroup', groupId: 'rg' },
  { level: 'columnGroup', groupId: 'cg' },
  { level: 'row', rowId: 'api' },
  { level: 'column', stageId: 'dev' },
  { level: 'cell', rowId: 'api', stageId: 'dev' },
];
const own = { statusSets: { github: 'github-single-job' } };

describe('settings places', () => {
  it.each(PLACES)('sets and reads the object at %o', (place) => {
    const next = setSettings(d, place, own);
    expect(settingsAt(next, place)).toMatchObject(own);
    // Every other place is untouched.
    for (const other of PLACES.filter((p) => p !== place))
      expect(settingsAt(next, other)).toEqual(settingsAt(d, other));
  });

  it('finds no object at a place that does not exist', () => {
    for (const place of [
      { level: 'rowGroup', groupId: 'x' },
      { level: 'columnGroup', groupId: 'x' },
      { level: 'row', rowId: 'x' },
      { level: 'column', stageId: 'x' },
      { level: 'cell', rowId: 'x', stageId: 'dev' },
      { level: 'cell', rowId: 'api', stageId: 'x' },
    ] as const)
      expect(settingsAt(d, place)).toBeUndefined();
  });

  it("keeps the dashboard's requests in flight, and drops a cell's emptied object", () => {
    const set = setSettings(d, { level: 'dashboard' }, own);
    expect(set.settings.requestsInFlight).toEqual(d.settings.requestsInFlight);
    const cell: SettingsPlace = { level: 'cell', rowId: 'api', stageId: 'dev' };
    const emptied = setSettings(setSettings(d, cell, own), cell, {});
    expect(emptied.rows[0]?.cellSettings).toEqual({});
  });

  it('lists every held object with its path, and rewrites them all', () => {
    const withCell = setSettings(d, PLACES[5], own);
    expect(heldSettings(withCell).map((h) => h.path)).toEqual([
      ['settings'],
      ['rowGroups', 0, 'settings'],
      ['columnGroups', 0, 'settings'],
      ['stages', 0, 'settings'],
      ['rows', 0, 'settings'],
      ['rows', 0, 'cellSettings', 'dev'],
    ]);
    const all = mapSettings(withCell, () => ({ githubToken: 't' }));
    expect(PLACES.map((p) => settingsAt(all, p)?.githubToken)).toEqual(
      PLACES.map(() => 't'),
    );
  });
});

describe('the settings object', () => {
  it('writes and resets a credential field', () => {
    const set = writeSetting({}, 'awsKey', 'amplify', 'k');
    expect(set).toEqual({ awsKey: 'k' });
    expect(writeSetting(set, 'awsKey', 'amplify', undefined)).toEqual({});
  });

  it('writes a per-source field under its source, dropping an emptied group', () => {
    const set = writeSetting({}, 'itemRules', 'github', always);
    expect(set).toEqual({ itemRules: { github: always } });
    expect(readSetting(set, 'itemRules', 'github')).toBe(always);
    expect(readSetting(set, 'itemRules', 'amplify')).toBeUndefined();
    const both = writeSetting(set, 'itemRules', 'amplify', always);
    expect(writeSetting(both, 'itemRules', 'github', undefined)).toEqual({
      itemRules: { amplify: always },
    });
    expect(writeSetting(set, 'itemRules', 'github', undefined)).toEqual({});
    expect(readSetting(undefined, 'githubToken', 'github')).toBeUndefined();
  });

  it('counts each field, and each source of a per-source field, once', () => {
    expect(countSet(undefined)).toBe(0);
    expect(countSet({})).toBe(0);
    expect(
      countSet({
        githubToken: 'g',
        awsKey: 'a',
        statusSets: { github: 's', amplify: 't' },
        itemRules: { amplify: always },
      }),
    ).toBe(5);
  });
});
