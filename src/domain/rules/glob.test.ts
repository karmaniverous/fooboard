/**
 * Tests for globs: whole-value matching, `*` across `/`, `?`, sets with
 * ranges and negation, nested `{a,b}`, literal regex characters, unclosed
 * brackets as literals, and case.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { globToRegExp } from './glob';

describe('globToRegExp', () => {
  it.each([
    ['main', 'main', true],
    ['main', 'mainline', false],
    ['preview/*', 'preview/a/b', true],
    ['*test*', 'Run tests (prod)', true],
    ['v?.0', 'v2.0', true],
    ['v?.0', 'v2x0', false],
    ['[abc]x', 'bx', true],
    ['[a-c]x', 'dx', false],
    ['[!a-c]x', 'dx', true],
    ['{failure,timed_out}', 'timed_out', true],
    ['{failure,timed_out}', 'failure2', false],
    ['deploy{,-{dev,prod}}', 'deploy-prod', true],
    ['deploy{,-{dev,prod}}', 'deploy', true],
    ['a.b+(c)', 'a.b+(c)', true],
    ['a.b', 'axb', false],
    ['[oops', '[oops', true],
    ['{oops', '{oops', true],
    ['{a,[b,c]}', 'c', true],
    ['{a,[b,c]}', ',', true],
  ])('%s against %s: %s', (glob, value, expected) => {
    expect(globToRegExp(glob, false).test(value)).toBe(expected);
  });

  it('ignores case only when asked', () => {
    expect(globToRegExp('FAIL*', true).test('failure')).toBe(true);
    expect(globToRegExp('FAIL*', false).test('failure')).toBe(false);
  });

  it('throws on an impossible range, for the caller to report', () => {
    expect(() => globToRegExp('[z-a]', false)).toThrow();
  });
});
