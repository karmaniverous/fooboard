/**
 * Tests for *only items where*: the filter path, that its check matches
 * records by their items, and parity with glob checks: for sets, negated
 * sets, alternatives, wildcards, regex characters and ignore case, the
 * builder's check matches exactly the values a glob check matches.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { is } from '@/domain/model/ruleBuilders';
import { evaluateCheck } from '@/domain/rules/check';
import { compilePath, ROOT_PATH } from '@/domain/rules/path';

import { itemsWhere, itemsWherePath } from './itemsWhere';

const items = (name: string) => ({ items: [{ name }] });

/** Does the builder's check match an item named `value`? */
const viaBuilder = (glob: string, ignoreCase: boolean, value: string) =>
  evaluateCheck(itemsWhere('name', glob, ignoreCase), items(value));

/** Does a glob check match `value`? */
const viaGlob = (glob: string, ignoreCase: boolean, value: string) =>
  evaluateCheck({ ...is(ROOT_PATH, glob), ignoreCase }, value);

const CASES: [string, string, readonly string[]][] = [
  ['sets', '[ab]*', ['apple', 'banana', 'cherry', '', 'a']],
  ['ranges', '[a-c]x', ['ax', 'cx', 'dx', 'Bx']],
  ['negated sets', '[!a-c]x', ['dx', 'ax', 'x', 'Dx']],
  ['set specials', '[-^\\]]', ['-', '^', ']', '\\', 'a']],
  ['alternatives', '{deploy,test}', ['deploy', 'test', 'deploytest', 'Test']],
  [
    'nested alternatives',
    'deploy{,-{dev,prod}}',
    ['deploy', 'deploy-prod', 'deploy-'],
  ],
  ['star', 'build*', ['build', 'build api', 'build\nlog', 'rebuild']],
  ['question mark', 'v?.0', ['v2.0', 'v20', 'v.0', 'v\n.0']],
  ['regex characters', 'a.b+(c)|$^{x}', ['a.b+(c)|$^{x}', 'axbb(c)', 'a.b+c']],
  ['backslashes', 'a\\b', ['a\\b', 'ab']],
  ['unclosed brackets', '[oops{', ['[oops{', 'o']],
  ['slashes', 'release/*', ['release/1.2', 'release/a/b', 'release']],
];

describe('itemsWhere', () => {
  it('writes a filter path', () => {
    expect(itemsWherePath('name', 'de?', false)).toBe(
      "$.items[?match(@.name, 'de([^\\\\n]|\\\\n)')]",
    );
  });

  it('quotes an item key that is not an identifier', () => {
    expect(itemsWherePath('job name', 'x', false)).toBe(
      "$.items[?match(@['job name'], 'x')]",
    );
    expect(viaBuilder('x', false, 'x')).toBe(true);
  });

  it('matches records by their items, ignoring case when asked', () => {
    const record = { items: [{ name: 'Deploy API' }, { name: 'lint' }] };
    expect(evaluateCheck(itemsWhere('name', 'deploy*', true), record)).toBe(
      true,
    );
    expect(evaluateCheck(itemsWhere('name', 'deploy*', false), record)).toBe(
      false,
    );
    expect(evaluateCheck(itemsWhere('name', 'lint', false), record)).toBe(true);
  });

  describe.each([false, true])(
    'agrees with glob checks (ignore case %s)',
    (ignoreCase) => {
      it.each(CASES)('for %s (%s)', (_, glob, values) => {
        expect(compilePath(itemsWherePath('name', glob, ignoreCase)).ok).toBe(
          true,
        );
        for (const value of values)
          expect([value, viaBuilder(glob, ignoreCase, value)]).toEqual([
            value,
            viaGlob(glob, ignoreCase, value),
          ]);
      });
    },
  );

  it('matches what glob checks match for sets and alternatives', () => {
    expect(viaBuilder('[ab]*', false, 'apple')).toBe(true);
    expect(viaBuilder('{deploy,test}', false, 'deploy')).toBe(true);
    expect(viaBuilder('[!a]x', false, 'ax')).toBe(false);
    expect(viaBuilder('a.b', true, 'A.B')).toBe(true);
    expect(viaBuilder('a.b', true, 'AxB')).toBe(false);
    expect(viaBuilder('[A-C]x', true, 'bX')).toBe(true);
  });
});
