/**
 * Tests for the C-13 layout rules with a fixed-width text measure: items
 * pack into lines as columns narrow, the richest fitting rung wins, tall
 * boards scroll down as little as possible, columns overflow right only
 * when icons (rung 0) cannot fit, density changes only padding, and zoom
 * moves along one scale.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  BASE_FONT_PX,
  capText,
  fitLayout,
  type LayoutInput,
  type Rung,
} from './layout';
import { type Content, minWidth, packContent } from './packing';
import { HEADER_GEAR_EM } from './settingsGearSize';
import { layoutAtZoom, snapZoom, stepZoom, zoomLabel, zoomRange } from './zoom';

/** Every character is 0.6 em wide. */
const measure = (text: string, px: number) => text.length * px * 0.6;

const cell = (rung: Rung): Content => ({
  lead: rung === 0 ? 'x' : 'x Cancelled',
  items: [
    ...(rung >= 2 ? [{ key: 'time' as const, text: '59m' }] : []),
    ...(rung >= 3
      ? [
          { key: 'commit' as const, text: '0000000' },
          { key: 'extra' as const, text: 'deploy' },
        ]
      : []),
    ...(rung >= 4
      ? [{ key: 'branch' as const, text: 'release/24.3', free: true }]
      : []),
    ...(rung >= 5
      ? [
          {
            key: 'message' as const,
            text: 'Fix flaky checkout test',
            free: true,
          },
        ]
      : []),
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

describe('packContent', () => {
  it('puts everything on one line when it fits, else packs lines after the lead', () => {
    const c = cell(3); // lead 66, items 18 + 42 + 36 at 10 px, gaps 4.5
    const one = packContent(c, 500, 10, measure);
    expect(one).toMatchObject({ oneLine: true, lines: 1 });
    const two = packContent(c, 110, 10, measure);
    expect(two).toMatchObject({
      oneLine: false,
      lines: 2,
      lineOf: { time: 1, commit: 1, extra: 1 },
    });
    const three = packContent(c, 70, 10, measure);
    expect(three?.lineOf).toEqual({ time: 1, commit: 1, extra: 2 });
    expect(packContent(c, 40, 10, measure)).toBeNull();
  });

  it('cuts free text off rather than wrapping or widening for it', () => {
    const long: Content = {
      ...cell(5),
      items: [
        { key: 'branch', text: 'release/2024-q4-very-long-branch', free: true },
      ],
    };
    // 8 characters at 6 px each
    expect(minWidth(long, 10, measure)).toBe(Math.max(66, 48));
    expect(packContent(long, 66, 10, measure)?.lines).toBe(2);
  });

  it('shares a spanning label across its columns', () => {
    const label: Content = { lead: 'x'.repeat(20), items: [], span: 3 };
    expect(minWidth(label, 10, measure)).toBe(40);
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
    expect(l.rung).toBeGreaterThanOrEqual(1);
  });

  it('drops to icons before overflowing right, and overflows only when icons cannot fit', () => {
    const narrow = fitLayout(input({ width: 390, stages: 6 }), BASE_FONT_PX);
    expect(narrow).toMatchObject({ rung: 0, overflowX: false });
    const l = fitLayout(input({ width: 200, stages: 12 }), BASE_FONT_PX);
    expect(l).toMatchObject({ rung: 0, overflowX: true });
    expect(l.colWidth).toBe(
      Math.ceil(measure('x', 13)) + Math.ceil(2 * 0.6 * 13),
    );
  });

  it('packs every cell alike: if one wraps, all wrap', () => {
    const contents = (rung: Rung) => [
      cell(rung),
      { lead: 'x no branch', items: [] },
    ];
    const l = fitLayout(input({ width: 900, rows: 3, contents }), 13);
    const lines = Object.values(l.lineOf);
    expect(
      l.format === 'packed'
        ? lines.every((n) => n >= 1)
        : lines.every((n) => n === 0),
    ).toBe(true);
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
    const l = fitLayout(input({ width: 800, rowNames: ['x'.repeat(300)] }), 13);
    expect(l.rowNameWidth).toBeCloseTo(0.3 * 800);
  });

  it('keeps room in the row-name column for the header gear', () => {
    const l = fitLayout(input(), 13);
    expect(l.rowNameWidth).toBeCloseTo(
      measure('api-core', 13) + 2 * l.padX + HEADER_GEAR_EM * 13,
    );
  });

  it('keeps room after a header lead for its gear', () => {
    const header: Content = { lead: 'Release', items: [], trail: 1 };
    // 7 characters at 6 px, and 1 em of 10 px.
    expect(minWidth(header, 10, measure)).toBe(42 + 10);
    expect(packContent(header, 51, 10, measure)).toBeNull();
    expect(packContent(header, 52, 10, measure)?.lines).toBe(1);
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
    const phone = input({ width: 390, stages: 30, rows: 5 });
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

  it('adds detail on zoom-in even when width, not height, is the limit', () => {
    const phone = input({ width: 390, stages: 6, rows: 5 });
    const r = zoomRange(phone);
    const base = layoutAtZoom(phone, 1, r).rung;
    expect(layoutAtZoom(phone, 2, r).rung).toBeGreaterThan(base);
  });

  it('measures the zoom-in budget against the board at 100%', () => {
    // A board already two screens tall at 100%: 150% must allow 1.5x that.
    const tallBoard = input({ rows: 60, height: 500 });
    const r = zoomRange(tallBoard);
    const at100 = layoutAtZoom(tallBoard, 1, r);
    expect(at100.boardHeight).toBeGreaterThan(500);
    const richer = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2].find(
      (z) => layoutAtZoom(tallBoard, z, r).rung > at100.rung,
    );
    expect(richer).toBeDefined();
  });

  it('narrows the row-name column on phones', () => {
    const names = ['a-very-long-repository-name'];
    const phone = fitLayout(input({ width: 390, rowNames: names }), 13);
    expect(phone.rowNameWidth).toBeLessThanOrEqual(0.18 * 390);
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
    const label: Content = { lead: 'x'.repeat(24), items: [] };
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
