/**
 * Tests for staleness (spec.md §3, §4.3.5): behind vs diverged from compare
 * counts, the confirmed staleness-branch fallback chain, and no badge when
 * either side lacks a branch.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { computeStaleness, deriveStalenessBadge } from './staleness';

describe('computeStaleness', () => {
  it('returns undefined when there is nothing to compare', () => {
    expect(computeStaleness(undefined)).toBeUndefined();
  });

  it('returns undefined when the branches are even', () => {
    expect(computeStaleness({ aheadBy: 0, behindBy: 0 })).toBeUndefined();
  });

  it('is behind when only the source is ahead', () => {
    expect(computeStaleness({ aheadBy: 3, behindBy: 0 })).toEqual({
      kind: 'behind',
      count: 3,
    });
  });

  it('is diverged when both sides have commits the other lacks', () => {
    expect(computeStaleness({ aheadBy: 2, behindBy: 1 })).toEqual({
      kind: 'diverged',
      behind: 2,
      ahead: 1,
    });
  });

  it('is not behind when only the cell is ahead (nothing to promote)', () => {
    expect(computeStaleness({ aheadBy: 0, behindBy: 4 })).toBeUndefined();
  });
});

describe('deriveStalenessBadge', () => {
  it('shows no badge when the cell has no branch', () => {
    expect(
      deriveStalenessBadge({
        cellBranch: undefined,
        sourceBranch: 'main',
        compare: { aheadBy: 3, behindBy: 0 },
      }),
    ).toBeUndefined();
  });

  it('shows no badge when the source has no branch', () => {
    expect(
      deriveStalenessBadge({
        cellBranch: 'dev',
        sourceBranch: undefined,
        compare: { aheadBy: 3, behindBy: 0 },
      }),
    ).toBeUndefined();
  });

  it('shows the behind badge when both sides have a branch and counts say behind', () => {
    expect(
      deriveStalenessBadge({
        cellBranch: 'dev',
        sourceBranch: 'main',
        compare: { aheadBy: 3, behindBy: 0 },
      }),
    ).toEqual({ kind: 'behind', count: 3 });
  });
});
