/**
 * Tests for the group gutters and frames on the board grid (spec.md §3.7,
 * Decision 13): gutters only at group boundaries, as tracks of their own,
 * with the board's size the layout's; one frame per column group spanning
 * every grid row from gutter to gutter; and one continuous line per
 * row-group boundary, carried across the pinned row names.
 *
 * @module
 */
import { screen, within } from '@testing-library/react';
import { pick } from 'radash';
import { describe, expect, it } from 'vitest';

import {
  amplifyIds,
  board,
  frames,
  labelledBoard,
  LAYOUT,
  renderFramed as render,
  rowLines,
  sum,
  tracks,
  ungroupedIds,
} from '@/test/framesBoard';

import { boardGroups, FRAME_LINE_PX, rowLineInLabel } from './groupGutters';
import { fitLayout } from './layout';

describe('group gutters', () => {
  it('puts gutters only at group boundaries, each a track of its own', () => {
    const grid = render();
    // Row names; a gutter; Preview's three stages; a gutter; Dev; a
    // gutter; Release (the single-member group); a gutter; Prod.
    expect(grid.style.gridTemplateColumns).toBe(
      '120px 7px 100px 100px 100px 7px 100px 7px 100px 7px 100px',
    );
    // The strip and the stage headers; Backend's label row and its rows;
    // a gutter above the ungrouped rows; a gutter above unlabelled
    // Frontend: never a gutter above a label row.
    const rows = tracks(grid.style.gridTemplateRows);
    expect(rows.filter((r) => r === LAYOUT.gutter)).toHaveLength(2);
    expect(rows.slice(0, 6)).toEqual([20, 20, 20, 30, 30, 30]);
    expect(rows[6]).toBe(7);
    expect(rows).toHaveLength(
      2 + 1 + 3 + 1 + ungroupedIds.length + 1 + amplifyIds.length,
    );
  });

  it('places every stage header and cell in its stage column, never a gutter', () => {
    const grid = render();
    const expected = ['3', '4', '5', '7', '9', '11'];
    const headers = within(grid)
      .getAllByRole('columnheader')
      .filter((h) => h.tabIndex === 0);
    expect(headers.map((h) => h.style.gridColumn)).toEqual(expected);
    for (const row of within(grid).getAllByRole('row')) {
      const cells = within(row).queryAllByRole('gridcell');
      if (cells.length === 0) continue;
      expect(cells.map((c) => c.style.gridColumn)).toEqual(expected);
      expect(within(row).getByRole('rowheader').style.gridColumn).toBe('1');
    }
  });

  it("is the layout's size: the layout counts the gutters it lays", () => {
    const groups = boardGroups(board);
    const layout = fitLayout(
      {
        width: 1440,
        height: 800,
        rows: board.rows.length,
        stages: board.stages.length,
        ...pick(groups, ['labelRows', 'columnGutters', 'rowGutters']),
        rowNames: board.rows.map((r) => r.displayName),
        contents: () => [{ lead: 'x Cancelled', items: [] }],
        measure: (text, px) => text.length * px * 0.6,
        density: 'default',
        headerGears: true,
      },
      13,
    );
    const grid = render(board, layout);
    const cols = tracks(grid.style.gridTemplateColumns);
    const rows = tracks(grid.style.gridTemplateRows);
    // Gaps between tracks (the layout counts one more below the last row).
    expect(sum(cols) + layout.gap * (cols.length - 1)).toBeCloseTo(
      layout.boardWidth,
    );
    expect(sum(rows) + layout.gap * rows.length).toBeCloseTo(
      layout.boardHeight,
    );
    expect(cols.filter((c) => c === layout.gutter)).toHaveLength(
      groups.columnGutters,
    );
  });
});

describe('column group frames', () => {
  it('draws one frame per column group, every grid row from gutter to gutter', () => {
    const grid = render();
    const drawn = frames(grid);
    expect(drawn.map((f) => f.dataset.frame)).toEqual(['preview', 'single']);
    expect(drawn.map((f) => f.style.gridColumn)).toEqual(['2 / 7', '8 / 11']);
    for (const f of drawn) {
      expect(f.style.gridRow).toBe('1 / -1');
      expect(f).toHaveClass('absolute', 'border-frame', 'pointer-events-none');
      // Its side lines in the middle of the gutters at its edges.
      const inset = `${String((LAYOUT.gutter - FRAME_LINE_PX) / 2)}px`;
      expect(f.style.left).toBe(inset);
      expect(f.style.right).toBe(inset);
      expect(f.style.borderWidth).toBe(
        `${String(FRAME_LINE_PX)}px ${String(FRAME_LINE_PX)}px 0px`,
      );
    }
    // The grid is their containing block.
    expect(grid).toHaveClass('relative');
  });

  it('draws no frame without column groups', () => {
    expect(frames(render({ ...board, columnGroups: [] }))).toHaveLength(0);
  });
});

describe('row group boundaries', () => {
  it('draws one line across every column at each boundary, in its gutter or above its label', () => {
    // Frontend labelled again: the ungrouped rows get a gutter, Frontend's
    // label row carries its line.
    const grid = render(labelledBoard);
    const lines = rowLines(grid);
    expect(lines).toHaveLength(2);
    for (const l of lines)
      expect(l).toHaveClass('absolute', 'inset-x-0', 'bg-frame');
    // In the gutter row, which spans every column, centred.
    const gutterRow = lines[0].parentElement;
    expect(gutterRow?.style.gridColumn).toBe('1 / -1');
    expect(lines[0].style.top).toBe(
      `${String((LAYOUT.gutter - FRAME_LINE_PX) / 2)}px`,
    );
    // In Frontend's label row, which spans every column, above the label.
    const label = screen.getByRole('rowheader', { name: /Frontend/ });
    expect(label).toHaveClass('col-span-full');
    expect(lines[1].parentElement).toBe(label);
    expect(lines[1].style.top).toBe(
      `${String(rowLineInLabel(LAYOUT.padY, LAYOUT.gap))}px`,
    );
    // The first segment's label row has none.
    const backend = screen.getByRole('rowheader', { name: /Backend/ });
    expect(backend.querySelector('[data-boundary]')).toBeNull();
  });

  it('carries its own piece of each line on the pinned cover over the row names', () => {
    const grid = render();
    for (const l of rowLines(grid)) {
      const holder = l.parentElement;
      if (!holder) throw new Error('no holder');
      const cover = [...holder.children].find((c) =>
        c.classList.contains('sticky'),
      );
      if (!(cover instanceof HTMLElement)) throw new Error('no cover');
      const piece = cover.querySelector<HTMLElement>('.bg-frame');
      expect(piece?.style.top).toBe(l.style.top);
      expect(piece).toHaveClass('w-[var(--row-name-w)]');
    }
  });

  it('draws no row line without row groups', () => {
    expect(rowLines(render({ ...board, rowGroups: [] }))).toHaveLength(0);
  });
});
