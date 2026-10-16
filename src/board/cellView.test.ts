/**
 * Tests for the pure cell-presentation rules: detail level boundaries per
 * row height, badge text, and relative-time buckets.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { badgeText, detailLevel, fitFontSize, relativeTime } from './cellView';

describe('detailLevel', () => {
  it.each([
    [40, 12, 'compact', 1],
    [64, 12, 'compact', 2],
    [120, 12, 'compact', 3],
    [190, 12, 'compact', 4],
    [96, 12, 'full', 3],
    [150, 12, 'full', 4],
    // the same width at a smaller font fits more detail
    [96, 8, 'compact', 3],
  ] as const)(
    '%ipx at %ipx font, %s, shows level %i',
    (width, font, height, level) => {
      expect(detailLevel(width, font, height)).toBe(level);
    },
  );
});

describe('fitFontSize', () => {
  it('scales with the cell height within readable bounds', () => {
    expect(fitFontSize(20, 'compact')).toBe(12);
    expect(fitFontSize(8, 'compact')).toBe(7);
    expect(fitFontSize(200, 'compact')).toBe(13);
    expect(fitFontSize(36, 'full')).toBeCloseTo(11.88);
  });
});

describe('badgeText', () => {
  it('shows a count when behind and behind/ahead when diverged', () => {
    expect(badgeText({ kind: 'behind', count: 3 })).toBe('3');
    expect(badgeText({ kind: 'diverged', behind: 3, ahead: 2 })).toBe('3/2');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  it.each([
    ['2026-10-16T11:59:30Z', 'now'],
    ['2026-10-16T11:56:00Z', '4m'],
    ['2026-10-16T09:00:00Z', '3h'],
    ['2026-10-14T12:00:00Z', '2d'],
    ['2026-09-18T12:00:00Z', '4w'],
    ['2026-10-16T12:05:00Z', 'now'],
  ])('%s is %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
