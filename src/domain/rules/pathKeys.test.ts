/**
 * Tests for the keys a path names: record keys, items and their keys
 * (after a wildcard, an index or a filter, and inside the filter), item
 * scope, `_raw` and descendant segments unchecked, bad paths undefined.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { pathKeys } from './pathKeys';

const r = (name: string) => ({ scope: 'record', name });
const i = (name: string) => ({ scope: 'item', name });

describe('pathKeys', () => {
  it.each([
    ['$.workflow', 'record', [r('workflow')]],
    ['$.items[*].state', 'record', [r('items'), i('state')]],
    ['$.items[0]', 'record', [r('items')]],
    [
      "$.items[?search(@.name, 'x') && @.state == 'failed'].link",
      'record',
      [r('items'), i('name'), i('state'), i('link')],
    ],
    ['$.name', 'item', [i('name')]],
    ['$._raw.run.event', 'record', []],
    ['$..anything', 'record', []],
    ['$', 'record', []],
  ] as const)('%s (%s)', (path, scope, expected) => {
    expect(pathKeys(path, scope)).toEqual(expected);
  });

  it('is undefined for a path that does not parse', () => {
    expect(pathKeys('$.items[', 'record')).toBeUndefined();
  });
});
