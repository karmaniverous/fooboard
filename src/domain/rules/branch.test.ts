/**
 * Tests for branch rules: branch-pattern meaning kept (`*` stops at `/`,
 * `**` crosses it, regex characters literal, case kept) and the pattern
 * read back only from a rule that is exactly a branch rule.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { branchOf, branchRule } from './branch';
import { evaluateRule } from './check';

describe('branchRule', () => {
  it.each([
    ['main', 'main', true],
    ['main', 'Main', false],
    ['main', 'mainline', false],
    ['preview/*', 'preview/a', true],
    ['preview/*', 'preview/a/b', false],
    ['preview/*', 'preview/', false],
    ['a*b', 'ab', false],
    ['a*b', 'axb', true],
    ['release/**', 'release/1/2', true],
    ['release/**', 'release/', false],
    ['v1.0+x', 'v1.0+x', true],
    ['v1.0+x', 'v1x0+x', false],
  ])('%s against %s: %s', (pattern, branch, expected) => {
    expect(evaluateRule(branchRule(pattern), { branch })).toBe(expected);
  });
});

describe('branchOf', () => {
  it.each(['main', 'preview/*', 'release/**', 'v1.0+x', 'a*b/**'])(
    'reads %s back',
    (pattern) => {
      expect(branchOf(branchRule(pattern))).toBe(pattern);
    },
  );

  it('reads nothing back from any other rule', () => {
    const [check] = branchRule('main').checks;
    expect(branchOf(undefined)).toBeUndefined();
    expect(branchOf({ combine: 'and', checks: [] })).toBeUndefined();
    expect(
      branchOf({ combine: 'and', checks: [{ ...check, not: true }] }),
    ).toBeUndefined();
    expect(
      branchOf({ combine: 'and', checks: [{ ...check, value: '^ma.n$' }] }),
    ).toBeUndefined();
    expect(
      branchOf({ combine: 'and', checks: [check, check] }),
    ).toBeUndefined();
  });
});
