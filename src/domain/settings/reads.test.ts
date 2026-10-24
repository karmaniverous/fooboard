/**
 * Tests for which fields a place offers and whether anything under it
 * reads them (Decision 53): a row or cell offers only what can apply to
 * its row; elsewhere every field is offered, and one no row under the
 * place reads is marked. Also the credentials a row's cells read, and the
 * pins a cell's key is served by.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';

import { cellCredentials, rowCredentials } from './credentials';
import { pinsFor, unusedPins } from './pins';
import type { SettingsPlace } from './places';
import { readsAt, rowReads, settableEntries, type SettingEntry } from './reads';

const d = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  credentials: [
    { id: 'g1', kind: 'github', label: 'g1' },
    { id: 'k1', kind: 'aws', label: 'k1' },
    { id: 'k2', kind: 'aws', label: 'k2' },
    { id: 'k3', kind: 'aws', label: 'k3' },
  ],
  settings: { githubToken: 'g1', awsKey: 'k1' },
  stages: [
    { id: 'dev', name: 'Dev' },
    { id: 'prod', name: 'Prod', settings: { awsKey: 'k2' } },
  ],
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      pinnedApps: [{ region: 'r', appId: 'a' }],
    },
    {
      type: 'amplify',
      id: 'bare',
      displayName: 'bare',
      pinnedApps: [
        { region: 'r', appId: 'k1-app', credentialId: 'k1' },
        { region: 'r', appId: 'k3-app', credentialId: 'k3' },
        { region: 'r', appId: 'any' },
      ],
    },
  ],
  rowGroups: [{ id: 'gh', memberIds: ['api'] }],
});
const fields = (entries: SettingEntry[]) =>
  entries.map((e) => ('source' in e ? `${e.field}.${e.source}` : e.field));
const ALL = [
  'githubToken',
  'awsKey',
  'statusSets.github',
  'itemRules.github',
  'statusSets.amplify',
  'itemRules.amplify',
];

describe('settableEntries', () => {
  it('offers every field in order away from rows, item rules only where read', () => {
    expect(
      fields(settableEntries(d, { level: 'dashboard' }, ['github', 'amplify'])),
    ).toEqual(ALL);
    expect(
      fields(settableEntries(d, { level: 'column', stageId: 'dev' }, [])),
    ).toEqual([
      'githubToken',
      'awsKey',
      'statusSets.github',
      'statusSets.amplify',
    ]);
  });

  it.each([
    [
      'a GitHub row',
      'api',
      ['githubToken', 'statusSets.github', 'itemRules.github'],
    ],
    [
      'an Amplify row with a repo',
      'site',
      ['githubToken', 'awsKey', 'statusSets.amplify', 'itemRules.amplify'],
    ],
    [
      'an Amplify row without one',
      'bare',
      ['awsKey', 'statusSets.amplify', 'itemRules.amplify'],
    ],
  ])(
    'offers %s only what applies to it, at the row and its cells',
    (_label, rowId, expected) => {
      const withItems = ['github', 'amplify'] as const;
      expect(
        fields(settableEntries(d, { level: 'row', rowId }, withItems)),
      ).toEqual(expected);
      expect(
        fields(
          settableEntries(
            d,
            { level: 'cell', rowId, stageId: 'dev' },
            withItems,
          ),
        ),
      ).toEqual(expected);
    },
  );

  it('offers nothing at a row that does not exist', () => {
    expect(settableEntries(d, { level: 'row', rowId: 'x' }, [])).toEqual([]);
  });
});

describe('readsAt', () => {
  const aws: SettingEntry = { field: 'awsKey' };
  const ghSet: SettingEntry = { field: 'statusSets', source: 'github' };
  it.each<[string, SettingsPlace, SettingEntry, boolean]>([
    ['the dashboard, AWS key', { level: 'dashboard' }, aws, true],
    [
      "a GitHub-only row group's AWS key",
      { level: 'rowGroup', groupId: 'gh' },
      aws,
      false,
    ],
    [
      "a GitHub-only row group's GitHub set",
      { level: 'rowGroup', groupId: 'gh' },
      ghSet,
      true,
    ],
    ['a missing row group', { level: 'rowGroup', groupId: 'x' }, ghSet, false],
    ['a column, AWS key', { level: 'column', stageId: 'dev' }, aws, true],
    ["a GitHub row's GitHub set", { level: 'row', rowId: 'api' }, ghSet, true],
    [
      "an Amplify cell's GitHub token",
      { level: 'cell', rowId: 'site', stageId: 'dev' },
      { field: 'githubToken' },
      true,
    ],
  ])(
    'says whether anything under %s reads it',
    (_label, place, entry, reads) => {
      expect(readsAt(d, place, entry)).toBe(reads);
    },
  );

  it('reads a GitHub token on an Amplify row only with a repo', () => {
    expect(
      rowReads({ type: 'amplify', repo: undefined }, { field: 'githubToken' }),
    ).toBe(false);
    expect(
      rowReads({ type: 'amplify', repo: 'a/b' }, { field: 'githubToken' }),
    ).toBe(true);
  });
});

describe('row credentials and pins', () => {
  const found = d.rows[2];
  if (found.type !== 'amplify') throw new Error('bare is Amplify');
  const bare: AmplifyRow = found;
  it("gives each cell its own key, and lists a row's distinct ones", () => {
    expect([...cellCredentials(d, bare, 'awsKey')]).toEqual([
      ['dev', 'k1'],
      ['prod', 'k2'],
    ]);
    expect(rowCredentials(d, bare, 'awsKey')).toEqual(['k1', 'k2']);
    // A row reading no GitHub token has none in any cell.
    expect([...cellCredentials(d, bare, 'githubToken').values()]).toEqual([
      undefined,
      undefined,
    ]);
    expect(rowCredentials(d, bare, 'githubToken')).toEqual([]);
  });

  it('reads what the row would with no column yet', () => {
    expect(
      rowCredentials({ ...d, stages: [] }, d.rows[0], 'githubToken'),
    ).toEqual(['g1']);
  });

  it('serves a key with its keyed pins, else the unkeyed ones', () => {
    expect(pinsFor(bare, 'k1').map((p) => p.appId)).toEqual(['k1-app']);
    expect(pinsFor(bare, 'k2').map((p) => p.appId)).toEqual(['any']);
    expect(unusedPins(d, bare).map((p) => p.appId)).toEqual(['k3-app']);
  });
});
