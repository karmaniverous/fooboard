/**
 * Tests for `getOrCreate`: a key's value is built once and then reused,
 * per key, with a `Map` or a `WeakMap`.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { getOrCreate } from './memo';

describe('getOrCreate', () => {
  it("builds a key's value once, then returns the cached one", () => {
    const cache = new Map<string, { n: number }>();
    let built = 0;
    const create = () => ({ n: (built += 1) });
    const a = getOrCreate(cache, 'a', create);
    expect(getOrCreate(cache, 'a', create)).toBe(a);
    expect(getOrCreate(cache, 'b', create)).not.toBe(a);
    expect(built).toBe(2);
  });

  it('works with a WeakMap keyed by object', () => {
    const cache = new WeakMap<object, string[]>();
    const key = {};
    const list = getOrCreate(cache, key, () => []);
    list.push('x');
    expect(getOrCreate(cache, key, () => [])).toEqual(['x']);
  });
});
