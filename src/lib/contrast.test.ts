/**
 * Tests for text on a fill: dark fills get white, light fills near-black,
 * and every bundled status colour gets text meeting WCAG AA (4.5:1).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PRESETS } from '@/domain/statuses/presets';
import { UNKNOWN } from '@/domain/statuses/resolved';

import { contrast, DARK_TEXT, luminance, textOn } from './contrast';

describe('textOn', () => {
  it('puts white on dark fills and near-black on light ones', () => {
    expect(textOn('#dc2626')).toBe('#ffffff');
    expect(textOn('#e2e8f0')).toBe(DARK_TEXT);
    expect(textOn('#ffff00')).toBe(DARK_TEXT);
    expect(textOn('#777777')).toBe('#000000');
  });

  it.each([
    UNKNOWN.color,
    // Mid-tone custom fills where neither white nor slate reaches AA.
    '#777777',
    '#7c7c7c',
    ...PRESETS.flatMap((p) => p.cell.map((s) => s.color)),
  ])('meets WCAG AA on %s', (color) => {
    expect(
      contrast(luminance(color), luminance(textOn(color))),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
