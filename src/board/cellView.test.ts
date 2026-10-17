/**
 * Tests for the pure cell-presentation rules: detail level boundaries per
 * row height, badge text, and relative-time buckets.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { badgeText, relativeTime } from './cellView';

describe('badgeText', () => {
  it('caps large counts at 99+', () => {
    expect(badgeText({ kind: 'behind', count: 100 })).toBe('99+');
    expect(badgeText({ kind: 'diverged', behind: 10000, ahead: 3 })).toBe(
      '99+/3',
    );
  });

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
