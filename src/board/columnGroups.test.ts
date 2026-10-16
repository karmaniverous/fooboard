/**
 * Tests for column grouping: segments cover every column whatever mix of
 * labelled and unlabelled dividers, so header cells can't drift.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { columnGroups } from './columnGroups';

const stages = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
  id,
  name: id,
  branchPattern: id,
}));

describe('columnGroups', () => {
  it('covers every column with labelled and unlabelled dividers mixed', () => {
    const dividers = new Map([
      ['b', { beforeId: 'b', style: 'thin' as const, label: 'Previews' }],
      ['d', { beforeId: 'd', style: 'dashed' as const }],
    ]);
    const groups = columnGroups(stages, dividers);
    expect(groups).toEqual([
      { label: '', start: 0, span: 1 },
      { label: 'Previews', start: 1, span: 2 },
      { label: '', start: 3, span: 2 },
    ]);
    expect(groups.reduce((n, g) => n + g.span, 0)).toBe(stages.length);
  });
});
