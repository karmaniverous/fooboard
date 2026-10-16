/**
 * Tests for the pure cell-presentation rules: detail level boundaries per
 * row height, badge text, and relative-time buckets.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { badgeText, detailLevel, relativeTime } from './cellView';

describe('detailLevel', () => {
  it.each([
    [40, 'compact', 1],
    [64, 'compact', 2],
    [119, 'compact', 2],
    [120, 'compact', 3],
    [190, 'compact', 4],
    [96, 'full', 3],
    [150, 'full', 4],
  ] as const)('%ipx %s shows level %i', (width, height, level) => {
    expect(detailLevel(width, height)).toBe(level);
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
