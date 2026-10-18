/**
 * Tests for the list helpers: moves are clamped at both ends; a patch
 * changes only its item and leaves the input alone.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { move, patchAt } from './lists';

describe('move', () => {
  it.each([
    [0, 1, ['b', 'a', 'c']],
    [2, -1, ['a', 'c', 'b']],
    [0, -1, ['a', 'b', 'c']],
    [2, 5, ['a', 'b', 'c']],
  ])('moves item %i by %i', (index, by, expected) => {
    expect(move(['a', 'b', 'c'], index, by)).toEqual(expected);
  });
});

describe('patchAt', () => {
  it('changes only the item at the index, without mutating', () => {
    const list = [
      { n: 1, k: 'a' },
      { n: 2, k: 'b' },
    ];
    expect(patchAt(list, 1, { n: 9 })).toEqual([
      { n: 1, k: 'a' },
      { n: 9, k: 'b' },
    ]);
    expect(list[1]).toEqual({ n: 2, k: 'b' });
  });
});
