/**
 * Tests for the board's smaller text (spec.md C-13, row N5a, Decision
 * 66): the floor at, below and above 100%, on every screen; and the
 * layout measuring badges and group labels as they are drawn.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { input, measure } from '@/test/layoutInput';

import {
  BADGE_BORDER_PX,
  BADGE_PAD_X_EM,
  BASE_FONT_PX,
  LABEL_TRACKING_EM,
  TEXT_EM,
  type TextEms,
  textEms,
} from './boardText';
import { fitLayout } from './layout';
import { minWidth } from './packing';

const every = (em: number): TextEms => ({
  badge: em,
  label: em,
  empty: em,
  sha: em,
});

describe('textEms', () => {
  it('floors every smaller text at the board text at and below 100%', () => {
    expect(textEms(BASE_FONT_PX)).toEqual(every(1));
    // 70%: as large as the board's text, never larger.
    expect(textEms(0.7 * BASE_FONT_PX)).toEqual(every(1));
  });

  it('floors at 13 px above 100%, where the ems allow less', () => {
    // At 15.6 px (120%) 13 px is 0.83 em: the badge grows to it, the rest
    // are larger already.
    const { badge, ...rest } = textEms(15.6);
    expect(badge).toBeCloseTo(BASE_FONT_PX / 15.6);
    expect(rest).toEqual({ label: 0.85, empty: 0.9, sha: 0.95 });
    expect(textEms(39)).toEqual(TEXT_EM);
  });
});

describe('the layout and the smaller text', () => {
  it('floors the smaller text on a phone and off it alike', () => {
    for (const width of [390, 639, 640, 1888])
      expect(fitLayout(input({ width }), BASE_FONT_PX).textEm).toEqual(
        every(1),
      );
    // Zoomed in, the layout passes its own text size to the floor.
    expect(fitLayout(input({ width: 1888 }), 39).textEm).toEqual(TEXT_EM);
  });

  it('keeps room for a badge as drawn: its count at its size, padding and border', () => {
    const content = { lead: 'x', badge: '12', items: [] };
    const room = (ems: TextEms) =>
      minWidth(content, 10, measure, ems) - measure('x', 10);
    // The gap before the badge, then the badge.
    const drawn = (em: number) =>
      0.45 * 10 + measure('12', em * 10) + 2 * BADGE_PAD_X_EM * em * 10;
    expect(room(TEXT_EM)).toBeCloseTo(drawn(0.8) + 2 * BADGE_BORDER_PX);
    expect(room(every(1))).toBeCloseTo(drawn(1) + 2 * BADGE_BORDER_PX);
  });

  it('gives every column room for its badge as drawn there', () => {
    const content = { lead: 'x', badge: '99+', items: [] };
    const drawn = minWidth(content, BASE_FONT_PX, measure, every(1));
    for (let width = 300; width < 1000; width += 1) {
      const l = fitLayout(
        input({ width, contents: () => [content] }),
        BASE_FONT_PX,
      );
      expect(l.colWidth - 2 * l.padX).toBeGreaterThanOrEqual(drawn - 0.01);
    }
  });

  it('measures a group label in capitals at its size, with its letter spacing', () => {
    // Capitals are wider than small letters.
    const cased = (text: string, px: number) =>
      (0.5 * text.length + 0.2 * (text.match(/[A-Z]/g)?.length ?? 0)) * px;
    const label = { lead: 'Prev', label: true, items: [] };
    const px = TEXT_EM.label * 10;
    expect(minWidth(label, 10, cased, TEXT_EM)).toBeCloseTo(
      4 * 0.7 * px + 4 * LABEL_TRACKING_EM * px,
    );
    // Anything else is measured as written, at the board's size.
    expect(minWidth({ ...label, label: false }, 10, cased, TEXT_EM)).toBe(
      cased('Prev', 10),
    );
  });
});
