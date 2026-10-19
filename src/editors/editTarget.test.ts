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
      focusKeys({ kind: 'row', id: 'web', part: 'items', stageId: 'dev' }),
    ).toEqual(['row:web:items', 'row:web:stage:dev', 'row:web']);
    expect(focusKeys({ kind: 'rowGroup', id: 'g' })).toEqual(['rowGroup:g']);
  });

  it('opens a stage or column group at its rules', () => {
    expect(focusKeys({ kind: 'stage', id: 'dev' })).toEqual([
      'stage:dev:rules',
      'stage:dev',
    ]);
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
    expect(targetKey({ kind: 'dashboard', part: 'statusSets' })).toBe(
      'dashboard:statusSets',
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
    [{ kind: 'dashboard', part: 'statusSets' }, 'Statuses'],
    [{ kind: 'dashboard', part: 'rowRules' }, 'General'],
  ] as const)('puts %o on %s', (target, tab) => {
    expect(tabFor(target)).toBe(tab);
  });
});
