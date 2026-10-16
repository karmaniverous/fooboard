/**
 * Tests for staleness (spec.md §3, §4.3.5): behind vs diverged from compare
 * counts, the confirmed staleness-branch fallback chain, and no badge when
 * either side lacks a branch.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  computeStaleness,
  deriveStalenessBadge,
  resolveStalenessBranch,
} from './staleness';

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

describe('resolveStalenessBranch', () => {
  it("prefers the cell's run branch when it has one", () => {
    expect(
      resolveStalenessBranch({
        runBranch: 'release/24.3',
        pattern: 'release/**',
      }),
    ).toBe('release/24.3');
  });

  it('falls back to the literal pattern branch when it exists and there is no run', () => {
    expect(
      resolveStalenessBranch({ pattern: 'main', literalBranchExists: true }),
    ).toBe('main');
  });

  it('returns undefined for a literal pattern whose branch does not exist', () => {
    expect(
      resolveStalenessBranch({ pattern: 'main', literalBranchExists: false }),
    ).toBeUndefined();
  });

  it('falls back to the most recently updated matching branch for a glob', () => {
    const result = resolveStalenessBranch({
      pattern: 'release/**',
      matchingBranches: [
        { name: 'release/24.2', updatedAt: '2026-09-01T00:00:00Z' },
        { name: 'release/24.3', updatedAt: '2026-10-01T00:00:00Z' },
      ],
    });
    expect(result).toBe('release/24.3');
  });

  it('returns undefined for a glob with no matching branches', () => {
    expect(
      resolveStalenessBranch({ pattern: 'release/**', matchingBranches: [] }),
    ).toBeUndefined();
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
