/**
 * Tests for *only items where*: the filter path (globs, escaping, letter
 * classes for ignore case) and that its check matches records by their
 * items.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { evaluateCheck } from '@/domain/rules/check';

import { itemsWhere, itemsWherePath } from './itemsWhere';

describe('itemsWhere', () => {
  it('writes a filter path', () => {
    expect(itemsWherePath('name', 'deploy*', false)).toBe(
      "$.items[?match(@.name, 'deploy.*')]",
    );
    expect(itemsWherePath('name', 'a.b', true)).toBe(
      "$.items[?match(@.name, '[Aa]\\.[Bb]')]",
    );
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
