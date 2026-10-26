/**
 * Tests that the layout includes the group gutters (spec.md §3.7): each
 * column gutter (its track and a gap) comes out of the columns' width and
 * each row gutter is added to the board's height, so fit-to-screen stays
 * exact; the board's width counts them; and zoom's top step, found from
 * the board's width when width is the limit, still fits the top rung.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { input } from '@/test/layoutInput';

import { gutterPx } from './groupGutters';
import { fitLayout, layoutAtRung, TOP_RUNG } from './layout';
import { layoutAtZoom, zoomRange } from './zoom';

const FONT = 13;

describe('layout with group gutters', () => {
  it('takes each column gutter and its gap out of the columns', () => {
    const plain = layoutAtRung(input(), 1, FONT);
    const framed = layoutAtRung(input({ columnGutters: 2 }), 1, FONT);
    const g = gutterPx(FONT);
    expect(framed.gutter).toBeCloseTo(g);
    expect(framed.colWidth).toBe(
      Math.floor(
        (1440 - framed.rowNameWidth - framed.gap * 6 - 2 * (g + framed.gap)) /
          6,
      ),
    );
    expect(framed.colWidth).toBeLessThan(plain.colWidth);
    // The board's width is every track and the gaps between them.
    expect(framed.boardWidth).toBeCloseTo(
      framed.rowNameWidth +
        6 * (framed.colWidth + framed.gap) +
        2 * (g + framed.gap),
    );
    expect(framed.boardWidth).toBeLessThanOrEqual(1440);
  });

  it('adds each row gutter and its gap to the height', () => {
    const plain = layoutAtRung(input(), 1, FONT);
    const framed = layoutAtRung(input({ rowGutters: 3 }), 1, FONT);
    expect(framed.boardHeight - plain.boardHeight).toBeCloseTo(
      3 * (gutterPx(FONT) + framed.gap),
    );
  });

  it('scrolls a board that fits only without its row gutters', () => {
    // One pixel to spare without gutters.
    const height =
      fitLayout(
        input({ rows: 20, contents: () => [{ lead: 'x', items: [] }] }),
        FONT,
      ).boardHeight + 1;
    const tight = (rowGutters: number) =>
      fitLayout(
        input({
          rows: 20,
          height,
          rowGutters,
          contents: () => [{ lead: 'x', items: [] }],
        }),
        FONT,
      );
    expect(tight(0).overflowY).toBe(false);
    expect(tight(1).overflowY).toBe(true);
  });

  it("finds zoom's top step with the gutters counted in the width", () => {
    // Width-bound: even rung 1 can't fit across a narrow window at 100%.
    const narrow = input({ width: 600, stages: 6, rows: 3, columnGutters: 6 });
    const range = zoomRange(narrow);
    const top = layoutAtZoom(narrow, range.top, range);
    expect(top.rung).toBe(TOP_RUNG);
    expect(top.overflowX).toBe(false);
  });
});
