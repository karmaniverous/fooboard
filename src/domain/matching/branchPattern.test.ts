/**
 * Tests for branch pattern matching (spec.md §3, §4.3.5): literal
 * branches, `*` within one segment, `**` across segments.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { isLiteralPattern, matchesBranchPattern } from './branchPattern';

describe('isLiteralPattern', () => {
  it('is true for a plain branch name', () => {
    expect(isLiteralPattern('main')).toBe(true);
  });

  it('is false for any wildcard pattern', () => {
    expect(isLiteralPattern('release/**')).toBe(false);
    expect(isLiteralPattern('preview/*')).toBe(false);
  });
});

describe('matchesBranchPattern', () => {
  it('matches a literal branch exactly', () => {
    expect(matchesBranchPattern('main', 'main')).toBe(true);
    expect(matchesBranchPattern('main', 'mainline')).toBe(false);
  });

  it('matches `*` within one segment only', () => {
    expect(matchesBranchPattern('preview/*', 'preview/bali')).toBe(true);
    expect(matchesBranchPattern('preview/*', 'preview/bali/extra')).toBe(false);
    expect(matchesBranchPattern('preview/*', 'preview/')).toBe(false);
  });

  it('matches `**` across segments', () => {
    expect(matchesBranchPattern('release/**', 'release/24.3')).toBe(true);
    expect(matchesBranchPattern('release/**', 'release/24/3')).toBe(true);
    expect(matchesBranchPattern('release/**', 'release/')).toBe(false);
  });

  it('does not match a different branch under a glob', () => {
    expect(matchesBranchPattern('release/**', 'main')).toBe(false);
    expect(matchesBranchPattern('preview/*', 'release/24.3')).toBe(false);
  });

  it('escapes regex-special characters in literal pattern segments', () => {
    expect(matchesBranchPattern('release/24.3', 'release/24x3')).toBe(false);
    expect(matchesBranchPattern('release/24.3', 'release/24.3')).toBe(true);
  });

  it('treats metacharacters in wildcard patterns literally', () => {
    expect(matchesBranchPattern('release/v?*', 'release/v?1')).toBe(true);
    expect(matchesBranchPattern('release/v?*', 'release/123')).toBe(false);
    expect(matchesBranchPattern('release/24.*', 'release/24x3')).toBe(false);
    expect(matchesBranchPattern('?*', '?x')).toBe(true);
  });
});
