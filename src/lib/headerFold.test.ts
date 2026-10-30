/**
 * Tests for folding the app header (spec.md C-19): nothing folds while the
 * row fits; then buttons fold from the right (Report an issue, GitHub,
 * ...), then the tagline, and README and News & support last.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { FOLD_ORDER, foldCount } from './headerFold';

const GAP = 8;
const FIXED = 100;
/** Distinct widths, so a fold of the wrong part would fit differently. */
const widths: Record<string, number> = {
  issue: 31,
  github: 32,
  ai: 39,
  import: 33,
  share: 34,
  theme: 35,
  demo: 36,
  tagline: 200,
  readme: 37,
  news: 38,
};
/** The row width with `ids` shown, as laid out (gaps between and at the
 * ends of the folding part). */
const rowWith = (ids: readonly string[]) =>
  FIXED +
  ids.reduce((a, id) => a + (widths[id] ?? 0), 0) +
  (ids.length + 1) * GAP;
/** What is still shown after a fold. */
const shownAfter = (room: number) =>
  FOLD_ORDER.slice(foldCount(widths, FIXED, room, GAP));

describe('foldCount', () => {
  const all = [...FOLD_ORDER];

  it('folds nothing while everything fits', () => {
    expect(shownAfter(rowWith(all))).toEqual(all);
  });

  it('folds Report an issue first, then GitHub', () => {
    expect(shownAfter(rowWith(all) - 1)).not.toContain('issue');
    expect(shownAfter(rowWith(all) - 1)).toContain('github');
    const noIssue = all.filter((id) => id !== 'issue');
    expect(shownAfter(rowWith(noIssue) - 1)).not.toContain('github');
  });

  it('folds Set up with an AI assistant after GitHub and just before Import', () => {
    const before = all.slice(0, all.indexOf('ai'));
    expect(before).toEqual(['issue', 'github']);
    const rest = all.filter((id) => !before.includes(id));
    expect(shownAfter(rowWith(rest))).toContain('ai');
    expect(shownAfter(rowWith(rest) - 1)).not.toContain('ai');
    expect(shownAfter(rowWith(rest) - 1)).toContain('import');
  });

  it('keeps the tagline until every other button but README and News has folded', () => {
    const lastThree = ['tagline', 'readme', 'news'] as const;
    expect(shownAfter(rowWith(lastThree))).toEqual(lastThree);
    expect(shownAfter(rowWith(lastThree) - 1)).toEqual(['readme', 'news']);
    expect(shownAfter(rowWith(['readme', 'news']) - 1)).toEqual(['news']);
  });

  it('counts the gap it is given', () => {
    expect(foldCount(widths, FIXED, rowWith(all), GAP + 1)).toBe(1);
  });

  it('folds everything when even News & support does not fit', () => {
    expect(shownAfter(FIXED)).toEqual([]);
  });
});
