/**
 * Tests for settings origins and values in words (spec.md §3.11
 * *Origins*): each level's label (an unlabelled group named by its first
 * member), an inherited value as "<Level> default (<value>)", nothing to
 * inherit worded per field, the places winning over a field, and each
 * entry's name and description.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { all, is } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';
import type { SettingEntry } from '@/domain/settings/reads';

import {
  entryDescription,
  entryName,
  fromWords,
  inheritedWords,
  placeLabel,
  shadowWords,
  unlabelledGroup,
} from './origins';

const d = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [{ id: 'k1', kind: 'aws', label: 'Prod account' }],
  stages: [
    { id: 'dev', name: 'Dev' },
    { id: 'prod', name: 'Prod' },
  ],
  rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'API' }],
  rowGroups: [{ id: 'rg', memberIds: ['api'] }],
  columnGroups: [{ id: 'cg', memberIds: ['prod'] }],
});
const aws: SettingEntry = { field: 'awsKey' };
const set: SettingEntry = { field: 'statusSets', source: 'github' };
const rule: SettingEntry = { field: 'itemRules', source: 'amplify' };

describe('origins in words', () => {
  it.each([
    [{ level: 'dashboard' }, 'Dashboard Board'],
    [{ level: 'rowGroup', groupId: 'rg' }, 'Row group API'],
    [{ level: 'columnGroup', groupId: 'cg' }, 'Column group Prod'],
    [{ level: 'columnGroup', groupId: 'gone' }, 'Column group gone'],
    [{ level: 'row', rowId: 'api' }, 'Row API'],
    [{ level: 'row', rowId: 'gone' }, 'Row gone'],
    [{ level: 'column', stageId: 'dev' }, 'Column Dev'],
    [{ level: 'column', stageId: 'gone' }, 'Column gone'],
    [{ level: 'cell', rowId: 'api', stageId: 'dev' }, 'Cell API × Dev'],
    [{ level: 'builtIn' }, 'Built-in'],
  ] as const)('labels %o as %s', (origin, label) => {
    expect(placeLabel(d, origin)).toBe(label);
  });

  it('says where an inherited value is from, unless built in', () => {
    expect(fromWords(d, { level: 'rowGroup', groupId: 'rg' })).toBe('from API');
    expect(fromWords(d, { level: 'builtIn' })).toBeUndefined();
  });

  it.each([
    [aws, { level: 'dashboard' }, 'k1', 'Dashboard default (Prod account)'],
    [aws, { level: 'dashboard' }, 'gone', 'Dashboard default (gone)'],
    [aws, { level: 'builtIn' }, undefined, 'None (no default is set)'],
    [
      set,
      { level: 'builtIn' },
      'github-deploy-test',
      'Built-in (GitHub deploy and test)',
    ],
    [set, { level: 'row', rowId: 'api' }, 'mine', 'Row default (mine)'],
    [rule, { level: 'builtIn' }, always, 'Every item counts'],
    [
      rule,
      { level: 'column', stageId: 'dev' },
      all(is('$.jobType', 'RELEASE')),
      'Column default ($.jobType matches RELEASE)',
    ],
  ] as const)('words %o from %o as %s', (entry, origin, value, words) => {
    expect(inheritedWords(d, entry, origin, value)).toBe(words);
  });

  it('names the places that win, one or several', () => {
    const dev = { level: 'column', stageId: 'dev' } as const;
    const prod = { level: 'column', stageId: 'prod' } as const;
    const cell = { level: 'cell', rowId: 'api', stageId: 'dev' } as const;
    expect(shadowWords(d, aws, [])).toBeUndefined();
    expect(shadowWords(d, aws, [prod])).toBe(
      'Prod sets its own AWS key, which wins there',
    );
    expect(shadowWords(d, set, [dev, prod, cell])).toBe(
      'Dev, Prod and API × Dev set their own GitHub status set, which wins there',
    );
    expect(shadowWords(d, aws, [{ level: 'dashboard' }])).toBe(
      'Board sets its own AWS key, which wins there',
    );
  });

  it('names and describes every entry', () => {
    const entries: SettingEntry[] = [{ field: 'githubToken' }, aws, set, rule];
    expect(entries.map((e) => [entryName(e), entryDescription(e)])).toEqual([
      [
        'GitHub token',
        "Reads a GitHub row's repo, and an Amplify row's repo for its badges.",
      ],
      ['AWS key', 'The AWS account an Amplify cell reads its apps in.'],
      ['GitHub status set', 'The statuses GitHub cells show.'],
      [
        'Amplify item rule',
        "Which of a record's items count, for Amplify rows.",
      ],
    ]);
  });
});

describe('unlabelledGroup', () => {
  const labelled = DashboardSchema.parse({
    ...d,
    rowGroups: [{ id: 'rg', label: 'Backend', memberIds: ['api'] }],
  });
  it.each([
    [{ level: 'rowGroup', groupId: 'rg' } as const, d, true],
    [{ level: 'columnGroup', groupId: 'cg' } as const, d, true],
    [{ level: 'rowGroup', groupId: 'rg' } as const, labelled, false],
    [{ level: 'rowGroup', groupId: 'gone' } as const, d, false],
    [{ level: 'row', rowId: 'api' } as const, d, false],
    [{ level: 'dashboard' } as const, d, false],
  ])('finds %j an unlabelled group: %#', (origin, board, found) => {
    expect(unlabelledGroup(board, origin)).toEqual(found ? origin : undefined);
  });
});
