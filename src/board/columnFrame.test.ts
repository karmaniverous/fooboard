/**
 * Tests for the column-group lines (spec.md C-14b): a group's header is
 * framed on both sides; body lines run at every boundary and at a group's
 * outer edges, once each; ungrouped stages get no frame.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { columnLines } from './columnFrame';

const ids = ['a', 'b', 'c', 'd', 'e'];
const group = { id: 'g' };
const sorted = (s: ReadonlySet<string>) => [...s].sort();

describe('columnLines', () => {
  it('frames a group in the middle, with body lines at both its edges', () => {
    const lines = columnLines(
      [
        { start: 0, span: 1 },
        { group, start: 1, span: 2 },
        { start: 3, span: 2 },
      ],
      ids,
    );
    expect(sorted(lines.headerLeft)).toEqual(['b']);
    expect(sorted(lines.headerRight)).toEqual(['c']);
    expect(sorted(lines.bodyLeft)).toEqual(['b', 'd']);
    expect(sorted(lines.bodyRight)).toEqual([]);
  });

  it('draws the outer edges of groups at either end of the board', () => {
    const lines = columnLines(
      [
        { group, start: 0, span: 2 },
        { start: 2, span: 1 },
        { group: { id: 'h' }, start: 3, span: 2 },
      ],
      ids,
    );
    expect(sorted(lines.headerLeft)).toEqual(['a', 'd']);
    expect(sorted(lines.headerRight)).toEqual(['b', 'e']);
    expect(sorted(lines.bodyLeft)).toEqual(['a', 'c', 'd']);
    expect(sorted(lines.bodyRight)).toEqual(['e']);
  });

  it('draws nothing without groups', () => {
    const lines = columnLines([{ start: 0, span: 5 }], ids);
    expect(
      [
        lines.headerLeft,
        lines.headerRight,
        lines.bodyLeft,
        lines.bodyRight,
      ].map((s) => s.size),
    ).toEqual([0, 0, 0, 0]);
  });
});
