/**
 * Tests for problems themselves: ids stable per level and message, notes
 * dismissable and unmarked, and where each is fixed (its own target, else
 * its level's item).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { note, problem, targetOf } from './problem';

describe('problem', () => {
  it('ids by level and message; notes are dismissable', () => {
    expect(problem({ kind: 'row', id: 'a' }, 'x').id).toBe('row:a|x');
    expect(note({ kind: 'dashboard' }, 'y')).toMatchObject({
      id: 'dashboard|y',
      severity: 'note',
      dismissable: true,
    });
  });
});

describe('targetOf', () => {
  it('uses its own target, else its level', () => {
    expect(
      targetOf(
        problem({ kind: 'dashboard' }, 'x', false, {
          target: { kind: 'source', provider: 'amplify' },
        }),
      ),
    ).toEqual({ kind: 'source', provider: 'amplify' });
    expect(targetOf(problem({ kind: 'stage', id: 's' }, 'x'))).toEqual({
      kind: 'stage',
      id: 's',
    });
    expect(
      targetOf(problem({ kind: 'cell', rowId: 'r', stageId: 's' }, 'x')),
    ).toEqual({ kind: 'row', id: 'r', stageId: 's' });
    expect(targetOf(problem({ kind: 'dashboard' }, 'x'))).toEqual({
      kind: 'dashboard',
      part: 'rowRules',
    });
  });
});
