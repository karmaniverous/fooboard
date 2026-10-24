/**
 * Tests for edit targets: the keys the editor opens and scrolls to, most
 * specific first, and the tab each target lives on.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { focusKeys, statusSetItemsKey, tabFor, targetKey } from './editTarget';

describe('focusKeys', () => {
  it('opens a source key inside its source rule and its choice', () => {
    expect(
      focusKeys({ kind: 'source', provider: 'github', key: 'state' }),
    ).toEqual([
      'source:github:key:state',
      'source:github',
      'source-choice:github',
    ]);
    expect(focusKeys({ kind: 'source', provider: 'amplify' })).toEqual([
      'source:amplify',
      'source-choice:amplify',
    ]);
  });

  it('opens a row part or stage override inside its row', () => {
    expect(
      focusKeys({ kind: 'row', id: 'web', part: 'record', stageId: 'dev' }),
    ).toEqual(['row:web:record', 'row:web:stage:dev', 'row:web']);
    expect(focusKeys({ kind: 'rowGroup', id: 'g' })).toEqual(['rowGroup:g']);
  });

  it('opens a stage or column group at its rules', () => {
    expect(focusKeys({ kind: 'stage', id: 'dev' })).toEqual([
      'stage:dev:rules',
      'stage:dev',
    ]);
  });

  it.each([
    [
      { level: 'dashboard' },
      ['dashboard:settings:awsKey', 'dashboard:settings'],
    ],
    [
      { level: 'rowGroup', groupId: 'g' },
      ['rowGroup:g:settings:awsKey', 'rowGroup:g:settings', 'rowGroup:g'],
    ],
    [
      { level: 'columnGroup', groupId: 'c' },
      [
        'columnGroup:c:settings:awsKey',
        'columnGroup:c:settings',
        'columnGroup:c',
      ],
    ],
    [
      { level: 'row', rowId: 'web' },
      ['row:web:settings:awsKey', 'row:web:settings', 'row:web'],
    ],
    [
      { level: 'column', stageId: 'dev' },
      ['stage:dev:settings:awsKey', 'stage:dev:settings', 'stage:dev'],
    ],
    [
      { level: 'cell', rowId: 'web', stageId: 'dev' },
      [
        'row:web:cells:dev:settings:awsKey',
        'row:web:cells:dev:settings',
        'row:web:cells:dev',
      ],
    ],
  ] as const)('opens a setting at %o inside its place', (place, keys) => {
    expect(focusKeys({ kind: 'settings', place, field: 'awsKey' })).toEqual(
      keys,
    );
  });

  it('keys a per-source setting by its source', () => {
    expect(
      targetKey({
        kind: 'settings',
        place: { level: 'row', rowId: 'web' },
        field: 'statusSets',
        source: 'github',
      }),
    ).toBe('row:web:settings:statusSets:github');
  });

  it('opens a status set inside the status set choice', () => {
    expect(focusKeys({ kind: 'statusSet', id: 's' })).toEqual([
      'statusSet:s',
      'dashboard:statusSets',
    ]);
  });
});

describe('targetKey', () => {
  it('is the most specific key', () => {
    expect(targetKey({ kind: 'row', id: 'web', part: 'record' })).toBe(
      'row:web:record',
    );
    expect(targetKey({ kind: 'dashboard', part: 'rowRules' })).toBe(
      'dashboard:rowRules',
    );
    expect(statusSetItemsKey('s')).toBe('statusSet:s:items');
  });
});

describe('tabFor', () => {
  it.each([
    [{ kind: 'source', provider: 'github' }, 'Sources'],
    [{ kind: 'statusSet', id: 's' }, 'Statuses'],
    [{ kind: 'rowGroup', id: 'g' }, 'Rows'],
    [{ kind: 'columnGroup', id: 'c' }, 'Stages'],
    [{ kind: 'dashboard', part: 'stageRules' }, 'Stages'],
    [{ kind: 'dashboard', part: 'rowRules' }, 'General'],
    [
      { kind: 'settings', place: { level: 'dashboard' }, field: 'awsKey' },
      'General',
    ],
    [
      {
        kind: 'settings',
        place: { level: 'rowGroup', groupId: 'g' },
        field: 'awsKey',
      },
      'Rows',
    ],
    [
      {
        kind: 'settings',
        place: { level: 'row', rowId: 'r' },
        field: 'awsKey',
      },
      'Rows',
    ],
    [
      {
        kind: 'settings',
        place: { level: 'cell', rowId: 'r', stageId: 's' },
        field: 'awsKey',
      },
      'Rows',
    ],
    [
      {
        kind: 'settings',
        place: { level: 'column', stageId: 's' },
        field: 'awsKey',
      },
      'Stages',
    ],
    [
      {
        kind: 'settings',
        place: { level: 'columnGroup', groupId: 'c' },
        field: 'awsKey',
      },
      'Stages',
    ],
  ] as const)('puts %o on %s', (target, tab) => {
    expect(tabFor(target)).toBe(tab);
  });
});
