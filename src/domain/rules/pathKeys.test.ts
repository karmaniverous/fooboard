/**
 * Tests for what a path names: record keys, items and their keys (after a
 * wildcard, an index or a filter, and inside the filter, relative and
 * absolute), item scope, paths going on inside a key, what can't be
 * decided (under `_raw`, descendant segments, wildcards past the known
 * keys) listed as unchecked, and bad paths undefined.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { pathRefs } from './pathKeys';

const r = (name: string) => ({ scope: 'record', name });
const i = (name: string) => ({ scope: 'item', name });

describe('pathRefs', () => {
  it.each([
    ['$.workflow', 'record', [r('workflow')]],
    ['$.items[*].state', 'record', [r('items'), i('state')]],
    ['$.items[0]', 'record', [r('items')]],
    [
      "$.items[?search(@.name, 'x') && @.state == 'failed'].link",
      'record',
      [r('items'), i('name'), i('state'), i('link')],
    ],
    [
      '$.items[?@.name == $.workflow]',
      'record',
      [r('items'), i('name'), r('workflow')],
    ],
    ['$.name', 'item', [i('name')]],
    ['$', 'record', []],
  ] as const)('%s (%s) names its keys', (path, scope, expected) => {
    expect(pathRefs(path, scope)).toEqual({
      keys: expected,
      inside: [],
      unchecked: [],
    });
  });

  it('says when a path goes on inside a key', () => {
    expect(pathRefs('$.state.code', 'record')).toEqual({
      keys: [r('state')],
      inside: [r('state')],
      unchecked: [],
    });
    expect(pathRefs('$.name.first', 'item')?.inside).toEqual([i('name')]);
  });

  it.each([
    ['$._raw.run.event', 'a path under _raw'],
    ['$..anything', 'a descendant segment'],
    ['$.*', 'a wildcard'],
    ['$.items..name', 'a descendant segment'],
    ['$.items[*].*', 'a wildcard'],
  ])('lists %s as unchecked', (path, reason) => {
    expect(pathRefs(path, 'record')?.unchecked).toEqual([reason]);
  });

  it('checks _raw itself, which every record has', () => {
    expect(pathRefs('$._raw', 'record')).toEqual({
      keys: [],
      inside: [],
      unchecked: [],
    });
  });

  it('is undefined for a path that does not parse', () => {
    expect(pathRefs('$.items[', 'record')).toBeUndefined();
  });
});
