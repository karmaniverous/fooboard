/**
 * Tests for what the group frames leave alone and how they stack (spec.md
 * §3.7, §3.10, §3.11): no cell, header or label carries a boundary line;
 * group-label gears sit inside their groups; a narrow screen drops only
 * the gears; frames and lines are hidden from assistive technology; and
 * frames are drawn over the pinned top headers but under the pinned row
 * names, which stay solid between rows.
 *
 * @module
 */
import { cleanup, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FRAME_LINE_PX } from '@/board/groupGutters';
import {
  board,
  frames,
  labelledBoard,
  LAYOUT,
  renderFramed as render,
  rowLines,
} from '@/test/framesBoard';

describe('cells, headers and labels', () => {
  it('carry no boundary line of their own', () => {
    const grid = render();
    const boxes = [
      ...grid.querySelectorAll<HTMLElement>(
        '[role=gridcell],[role=rowheader],[role=columnheader]',
      ),
    ];
    expect(boxes.length).toBeGreaterThan(
      board.rows.length * board.stages.length,
    );
    for (const b of boxes) {
      expect(b.className).not.toMatch(/\bborder-/);
      expect(b.style.border + b.style.borderTop + b.style.borderLeft).toBe('');
    }
  });

  it('keep group-label gears inside their groups', () => {
    const grid = render();
    // Preview's label spans its three stages, inside its frame's gutters.
    const preview = within(grid).getByRole('columnheader', { name: /Preview/ });
    expect(preview.style.gridColumn).toBe('3 / span 3');
    within(preview).getByRole('button', {
      name: 'Settings for column group Preview',
    });
  });

  it('keeps a labelled row group gear below the line drawn above its label', () => {
    const grid2 = render(labelledBoard);
    const frontend = within(grid2).getByRole('rowheader', { name: /Frontend/ });
    const gear = within(frontend).getByRole('button', {
      name: 'Settings for row group Frontend',
    });
    const line = frontend.querySelector('[data-boundary=row]');
    expect(line?.compareDocumentPosition(gear)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe('on a narrow screen', () => {
  it('keeps every frame and line and drops only the header and label gears', () => {
    const grid = render(board, { ...LAYOUT, headerGears: false });
    expect(frames(grid)).toHaveLength(2);
    expect(rowLines(grid)).toHaveLength(2);
    expect(
      within(grid).queryAllByRole('button', { name: /^Settings for/ }),
    ).toHaveLength(0);
  });
});

describe('accessibility and stacking', () => {
  it('hides frames, lines and gutters from assistive technology', () => {
    const grid = render();
    const decor = [...frames(grid), ...rowLines(grid)];
    expect(decor).toHaveLength(4);
    for (const d of decor)
      expect(d.closest('[aria-hidden=true]')).not.toBeNull();
    // A line drawn in a label row, which is announced, hides itself, and
    // so does the cover's piece of it.
    cleanup();
    const labelled = render(labelledBoard);
    const inLabel = rowLines(labelled).filter((l) =>
      l.closest('[role=rowheader]'),
    );
    expect(inLabel).toHaveLength(1);
    const header = inLabel[0].closest('[role=rowheader]');
    for (const l of header?.querySelectorAll('.border-frame') ?? [])
      expect(l).toHaveAttribute('aria-hidden', 'true');
    // Nothing decorative is announced as a row or cell.
    expect(
      within(grid)
        .getAllByRole('row')
        .every((r) => !r.closest('[aria-hidden=true]')),
    ).toBe(true);
  });

  it('draws frames over the pinned top headers and under the pinned row names', () => {
    const grid = render();
    const z = (el: Element) =>
      el.className.match(/\bz-(\[\d+\]|\d+)/)?.[1].replace(/[[\]]/g, '');
    const frame = Number(z(frames(grid)[0]));
    const stage = within(grid).getByRole('columnheader', { name: /Bali/ });
    const row = within(grid)
      .getAllByRole('rowheader')
      .find((r) => r.tabIndex === 0);
    if (!row) throw new Error('no row header');
    expect(frame).toBeGreaterThan(Number(z(stage)));
    expect(frame).toBeLessThan(Number(z(row)));
    // Every pinned cover over a line is above the frames too, and the
    // pinned row names reach down through the gap below each row.
    for (const l of rowLines(grid)) {
      const cover = l.parentElement?.querySelector('.sticky');
      if (!cover) throw new Error('no cover');
      expect(Number(z(cover))).toBeGreaterThan(frame);
    }
    expect(row).toHaveClass(
      'after:top-full',
      'after:h-[var(--grid-gap)]',
      'after:bg-background',
    );
    expect(grid.style.getPropertyValue('--grid-gap')).toBe('3px');
    expect(grid.style.getPropertyValue('--row-name-w')).toBe('120px');
  });

  it('draws in what forced colours keep: lines as borders, covers on solid backgrounds', () => {
    // Windows high-contrast mode paints background colours as its canvas
    // and drops background images and shadows; borders take its text colour.
    const grid = render(labelledBoard);
    const decor = [
      ...grid.querySelectorAll<HTMLElement>('[data-frame], .border-frame'),
    ];
    expect(decor.length).toBeGreaterThan(4);
    for (const d of decor) {
      expect(d.className).not.toMatch(/\bbg-|shadow/);
      expect(d.style.background + d.style.backgroundImage).toBe('');
    }
    for (const l of rowLines(grid))
      expect(l.style.borderTopWidth).toBe(`${String(FRAME_LINE_PX)}px`);
    // The covers on the label rows and the gutter rows.
    const covers = [
      ...grid.querySelectorAll<HTMLElement>(
        '[role=rowheader] > span.sticky, [aria-hidden=true] > span.sticky',
      ),
    ];
    expect(covers.length).toBeGreaterThanOrEqual(3);
    for (const c of covers) {
      expect(c).toHaveClass('bg-background', 'w-[var(--row-name-w)]');
      expect(c.style.background + c.style.backgroundImage).toBe('');
    }
    const rowNames = within(grid)
      .getAllByRole('rowheader')
      .filter((r) => r.tabIndex === 0);
    expect(rowNames.length).toBeGreaterThan(0);
    for (const r of rowNames) expect(r.className).not.toMatch(/shadow/);
  });
});
