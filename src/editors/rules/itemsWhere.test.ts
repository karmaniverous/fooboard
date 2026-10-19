/**
 * Tests for *only items where*: the filter path (globs, escaping, letter
 * classes for ignore case) and that its check matches records by their
 * items.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { evaluateCheck } from '@/domain/rules/check';
import { compilePath } from '@/domain/rules/path';

import { itemsWhere, itemsWherePath } from './itemsWhere';

describe('itemsWhere', () => {
  it('writes a filter path', () => {
    expect(itemsWherePath('name', 'deploy*', false)).toBe(
      "$.items[?match(@.name, 'deploy.*')]",
    );
  });

  it('escapes regex characters and backslashes so the path parses and matches literally', () => {
    const items = (name: string) => ({ items: [{ name }] });
    const dotted = itemsWhere('name', 'a.b', true);
    expect(evaluateCheck(dotted, items('A.b'))).toBe(true);
    expect(evaluateCheck(dotted, items('axb'))).toBe(false);
    const slashed = itemsWhere('name', 'a\\b', false);
    expect(evaluateCheck(slashed, items('a\\b'))).toBe(true);
    expect(evaluateCheck(slashed, items('ab'))).toBe(false);
    for (const glob of ['(x)', '[x]', 'x+y', 'x|y', '{x}']) {
      expect(compilePath(itemsWherePath('name', glob, false)).ok).toBe(true);
      expect(evaluateCheck(itemsWhere('name', glob, false), items(glob))).toBe(
        true,
      );
    }
  });

  it('quotes an item key that is not an identifier', () => {
    expect(itemsWherePath('job name', 'x', false)).toBe(
      "$.items[?match(@['job name'], 'x')]",
    );
    expect(
      evaluateCheck(itemsWhere('job name', 'x', false), {
        items: [{ 'job name': 'x' }],
      }),
    ).toBe(true);
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
});
