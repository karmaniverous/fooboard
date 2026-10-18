/**
 * Tests for folding the app header (spec.md C-19): buttons fold from the
 * right, then the tagline, then README and News & support; nothing folds
 * while everything fits.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { FOLD_ORDER, foldCount } from './headerFold';

/** Every part 32 px, the tagline 200 px. */
const widths = Object.fromEntries(
  FOLD_ORDER.map((id) => [id, id === 'tagline' ? 200 : 32]),
);
/** The row width with the first `folded` parts gone (gaps of 8 px). */
const need = (folded: number, fixed = 100) => {
  const shown = FOLD_ORDER.slice(folded);
  const sum = shown.reduce((a, id) => a + (widths[id] ?? 0), 0);
  return fixed + sum + (shown.length + 1) * 8;
};

describe('foldCount', () => {
  it('folds nothing while everything fits', () => {
    expect(foldCount(widths, 100, need(0))).toBe(0);
  });

  it('folds Report an issue first, then GitHub', () => {
    expect(foldCount(widths, 100, need(0) - 1)).toBe(1);
    expect(FOLD_ORDER[0]).toBe('issue');
    expect(foldCount(widths, 100, need(1) - 1)).toBe(2);
    expect(FOLD_ORDER[1]).toBe('github');
  });

  it('drops the tagline after the other buttons, before README and News', () => {
    expect(FOLD_ORDER.slice(-3)).toEqual(['tagline', 'readme', 'news']);
    expect(foldCount(widths, 100, need(6))).toBe(6);
    expect(foldCount(widths, 100, need(6) - 1)).toBe(7);
  });

  it('folds everything when even the last buttons do not fit', () => {
    expect(foldCount(widths, 100, 50)).toBe(FOLD_ORDER.length);
  });
});
