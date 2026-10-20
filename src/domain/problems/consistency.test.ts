/**
 * Tests for the unused-source note: one per source, naming at most
 * PLACES_LISTED places.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { all, is } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';

import { PLACES_LISTED, unusedSourceNotes } from './consistency';
import type { RuleSite } from './sites';

const site = (id: string, rule = all(is('$.branch', 'main'))): RuleSite => ({
  level: { kind: 'stage', id },
  target: { kind: 'stage', id },
  what: 'Amplify stage rule',
  provider: 'amplify',
  rule,
  scope: 'record',
  sharedBy: ['web'],
});

describe('unusedSourceNotes', () => {
  it('names at most PLACES_LISTED places, then says there are more', () => {
    const many = Array.from({ length: PLACES_LISTED + 1 }, (_, i) =>
      site(`s${String(i)}`),
    );
    const [note] = unusedSourceNotes(many, [{ id: 'web', type: 'github' }]);
    const named = Array.from(
      { length: PLACES_LISTED },
      (_, i) => `stage s${String(i)}`,
    ).join(', ');
    expect(note.message).toBe(
      `Amplify rules where no row reads Amplify, so unused: ${named}, ...`,
    );
    expect(note.severity).toBe('note');
  });

  it('ignores empty rules and rules a row of their source reaches', () => {
    expect(
      unusedSourceNotes(
        [site('a', always), site('b')],
        [{ id: 'web', type: 'amplify' }],
      ),
    ).toEqual([]);
  });
});
