/**
 * Tests for the C-13 layout rules with a fixed-width text measure: formats
 * unwrap as columns widen, the richest fitting rung wins, tall boards fall
 * back to rung 1 and scroll down, columns overflow right only below rung 1
 * stacked, density changes only padding, and zoom moves along one scale.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  BASE_FONT_PX,
  capText,
  type Content,
  contentBox,
  fitLayout,
  layoutAtZoom,
  type LayoutInput,
  type Rung,
  snapZoom,
  stepZoom,
  zoomLabel,
  zoomRange,
} from './layout';

/** Every character is 0.6 em wide. */
const measure = (text: string, px: number) => text.length * px * 0.6;

const cell = (rung: Rung): Content => ({
  lead: '✓ Cancelled',
  rest: [
    ...(rung >= 2 ? ['59m'] : []),
    ...(rung >= 3 ? ['0000000', 'deploy'] : []),
  ],
  free: [
    ...(rung >= 4 ? ['release/24.3'] : []),
    ...(rung >= 5 ? ['Fix flaky checkout test'] : []),
  ],
});

const input = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  width: 1440,
  height: 800,
  rows: 10,
  stages: 6,
  labelRows: 0,
  rowNames: ['api-core'],
  contents: (rung) => [cell(rung)],
  measure,
  density: 'default',
  ...over,
});

describe('contentBox', () => {
  it('trades width for lines from line to wrapped to stacked', () => {
    const c = cell(3);
    const line = contentBox(c, 'line', 10, measure);
    const wrapped = contentBox(c, 'wrapped', 10, measure);
    const stacked = contentBox(c, 'stacked', 10, measure);
    expect(line.lines).toBe(1);
    expect(wrapped.lines).toBe(2);
    expect(stacked.lines).toBe(4);
    expect(line.width).toBeGreaterThan(wrapped.width);
    expect(wrapped.width).toBeGreaterThanOrEqual(stacked.width);
  });
});

describe('free text', () => {
  it('is cut off rather than forcing wider columns or more wrapping', () => {
    const long = (rung: Rung): Content => ({
      ...cell(rung),
      free: ['release/2024-q4-very-long-branch', 'A very long commit subject'],
    });
    const stacked = contentBox(cell(3), 'stacked', 10, measure);
    expect(contentBox(long(5), 'stacked', 10, measure).width).toBe(
      stacked.width,
    );
    const wrapped = contentBox(long(5), 'wrapped', 10, measure);
    // two free items count at 8 characters each, plus gaps
    expect(wrapped.width).toBeCloseTo(
      contentBox(cell(3), 'wrapped', 10, measure).width + 2 * (8 * 6 + 4.5),
    );
    expect(wrapped.lines).toBe(2);
  });
});

describe('fitLayout', () => {
  it('shows everything on one line on a wide board with room to spare', () => {
    const l = fitLayout(input({ stages: 2, rows: 3 }), BASE_FONT_PX);
    expect(l).toMatchObject({
      rung: 5,
      format: 'line',
      overflowX: false,
      overflowY: false,
    });
  });

  it('unwraps a few-column, many-row board to one line', () => {
    const l = fitLayout(
      input({ stages: 3, rows: 30, height: 900 }),
      BASE_FONT_PX,
    );
    expect(l.format).toBe('line');
    expect(l.overflowX).toBe(false);
  });

  it('chooses the richest rung that fits both ways', () => {
    const l = fitLayout(input({ rows: 21 }), BASE_FONT_PX);
    expect(l.overflowX || l.overflowY).toBe(false);
    // the next rung up would not fit
    const richer = fitLayout(input({ rows: 21, height: 10_000 }), BASE_FONT_PX);
    expect(richer.rung).toBeGreaterThan(l.rung);
  });

  it('scrolls down as little as possible, with the most detail at that height', () => {
    // Narrow columns: rung 2 still fits one line, rung 3 would wrap.
    const tall = input({ rows: 200, width: 1000 });
    const l = fitLayout(tall, BASE_FONT_PX);
    expect(l).toMatchObject({
      format: 'line',
      overflowY: true,
      overflowX: false,
    });
    expect(l.rowHeight).toBe(
      fitLayout(
        input({ rows: 200, width: 1000, contents: () => [cell(1)] }),
        BASE_FONT_PX,
      ).rowHeight,
    );
    expect(l.rung).toBeGreaterThan(1);
  });

  it('overflows right only when rung 1 stacked cannot fit, at that width', () => {
    const l = fitLayout(input({ width: 390, stages: 6 }), BASE_FONT_PX);
    expect(l).toMatchObject({ rung: 1, overflowX: true, format: 'stacked' });
    expect(l.colWidth).toBeCloseTo(measure('✓ Cancelled', 13) + 2 * 0.6 * 13);
  });

  it('keeps text at 13 px at 100% however large the board', () => {
    expect(
      fitLayout(input({ rows: 500, stages: 12 }), BASE_FONT_PX).fontPx,
    ).toBe(13);
  });

  it('changes only padding and gaps with density', () => {
    const tight = fitLayout(input({ rows: 3, density: 'compact' }), 13);
    const roomy = fitLayout(input({ rows: 3, density: 'comfortable' }), 13);
    expect(tight.fontPx).toBe(roomy.fontPx);
    expect(tight.padX).toBeLessThan(roomy.padX);
    expect(tight.rowHeight).toBeLessThan(roomy.rowHeight);
  });

  it('caps the row-name column at 30% of the grid area', () => {
    const l = fitLayout(input({ width: 600, rowNames: ['x'.repeat(300)] }), 13);
    expect(l.rowNameWidth).toBeCloseTo(0.3 * 600);
  });
});

describe('zoom', () => {
  const tall = input({ rows: 21 });
  const range = zoomRange(tall);

  it('goes down to 50% where columns already fit', () => {
    expect(range.min).toBe(0.5);
    expect(layoutAtZoom(tall, 0.1, range).fontPx).toBe(6.5);
  });

  it('goes below 50% only as far as columns need to fit, never below 25%', () => {
    const phone = input({ width: 390, stages: 10, rows: 5 });
    const r = zoomRange(phone);
    expect(layoutAtZoom(phone, 0.5, r).overflowX).toBe(true);
    expect(r.min).toBeGreaterThanOrEqual(0.25);
    expect(r.min).toBeLessThan(0.5);
    expect(layoutAtZoom(phone, r.min, r).overflowX).toBe(false);
    expect(zoomRange(input({ width: 390, stages: 40, rows: 5 })).min).toBe(
      0.25,
    );
  });

  it('above 100% treats zoom as a height budget at 13 px', () => {
    const at100 = layoutAtZoom(tall, 1, range);
    const at = (z: number) => layoutAtZoom(tall, z, range);
    expect(range.top).toBeGreaterThan(1);
    for (let z = 1.1; z <= range.top; z += 0.1) {
      const l = at(z);
      expect(l.fontPx).toBe(13);
      expect(l.overflowX).toBe(false);
      expect(l.rung).toBeGreaterThanOrEqual(at100.rung);
    }
    expect(at(range.top).rung).toBe(5);
  });

  it('magnifies past the top rung, up to 300% text', () => {
    const l = layoutAtZoom(tall, range.top * 2, range);
    expect(l).toMatchObject({ rung: 5, fontPx: 26 });
    expect(layoutAtZoom(tall, 99, range).fontPx).toBe(39);
  });

  it('steps by 10% on the 10% grid, snaps and labels', () => {
    expect(stepZoom(1, 1, range)).toBe(1.1);
    expect(stepZoom(1.14, 1, range)).toBe(1.2);
    expect(stepZoom(1.14, -1, range)).toBe(1.1);
    expect(stepZoom(1, -1, range)).toBe(0.9);
    expect(stepZoom(0.5, -1, range)).toBe(0.5);
    expect(snapZoom(1.26, range)).toBe(1.3);
    expect(zoomLabel(1.5, range)).toBe('150%');
    expect(zoomLabel(0.1, range)).toBe('50%');
  });

  it('measures group labels across the columns they span', () => {
    const label = { lead: 'x'.repeat(24), rest: [] };
    const alone = fitLayout(input({ width: 600, contents: () => [label] }), 13);
    expect(alone.overflowX).toBe(true);
    const spanned = fitLayout(
      input({ width: 600, contents: () => [{ ...label, span: 3 }] }),
      13,
    );
    expect(spanned.overflowX).toBe(false);
  });
});

describe('capText', () => {
  it('cuts free text at 40 characters', () => {
    expect(capText('a'.repeat(41))).toHaveLength(40);
    expect(capText('short')).toBe('short');
  });
});
