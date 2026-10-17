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
  maxZoom,
  type Rung,
  stepZoom,
  zoomLabel,
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
  it('never widens a stacked cell: it is cut off at the column width', () => {
    const narrow = contentBox(cell(3), 'stacked', 10, measure);
    const withText = contentBox(cell(5), 'stacked', 10, measure);
    expect(withText.width).toBe(narrow.width);
    expect(withText.lines).toBe(narrow.lines + 2);
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
  const fitted = fitLayout(tall, 13).rung;

  it('below 100% shrinks text, then enriches', () => {
    const phone = input({ width: 390, stages: 6, rows: 5 });
    expect(layoutAtZoom(phone, 1).overflowX).toBe(true);
    const out = layoutAtZoom(phone, 0.5);
    expect(out.fontPx).toBe(6.5);
    expect(out.overflowX).toBe(false);
  });

  it('above 100% climbs rungs at 13 px, then magnifies to 300%', () => {
    const one = layoutAtZoom(tall, stepZoom(1, 1, fitted));
    expect(one).toMatchObject({ rung: fitted + 1, fontPx: 13 });
    const top = layoutAtZoom(tall, maxZoom(fitted));
    expect(top).toMatchObject({ rung: 5, fontPx: 39 });
    expect(layoutAtZoom(tall, 99).fontPx).toBe(39);
  });

  it('snaps gestures to whole steps and labels the position', () => {
    expect(layoutAtZoom(tall, 1.1).rung).toBe(fitted);
    expect(zoomLabel(1.1, fitted)).toBe('100%');
    expect(zoomLabel(1.25, fitted)).toBe('Detail +1');
    expect(zoomLabel(0.75, fitted)).toBe('75%');
    expect(zoomLabel(maxZoom(fitted), fitted)).toBe('300%');
  });

  it('stops at 100% on the way in and out', () => {
    expect(stepZoom(0.8, 1, fitted)).toBe(1);
    expect(stepZoom(1.25, -1, fitted)).toBe(1);
    expect(stepZoom(1, -1, fitted)).toBe(0.8);
  });
});

describe('capText', () => {
  it('cuts free text at 40 characters', () => {
    expect(capText('a'.repeat(41))).toHaveLength(40);
    expect(capText('short')).toBe('short');
  });
});
