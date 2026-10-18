/**
 * Tests for group segmentation (spec.md C-14b): runs of grouped and
 * ungrouped items, as the board draws them.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { groupSegments } from './segments';

describe('groupSegments', () => {
  it('splits items into runs by group, ungrouped runs included', () => {
    const g = { id: 'g', label: 'G', memberIds: ['b', 'c'] };
    const h = { id: 'h', memberIds: ['d'] };
    expect(groupSegments(['a', 'b', 'c', 'd', 'e'], [g, h])).toEqual([
      { group: undefined, start: 0, span: 1 },
      { group: g, start: 1, span: 2 },
      { group: h, start: 3, span: 1 },
      { group: undefined, start: 4, span: 1 },
    ]);
    expect(groupSegments([], [g])).toEqual([]);
  });
});
