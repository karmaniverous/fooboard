/**
 * The simulator's seeded randomness (spec.md §3.14 *Engine*): the same
 * seed and stream give the same numbers, another stream or seed others,
 * all in [0, 1); draws within a range and picks from a list.
 */
import { describe, expect, it } from 'vitest';

import { between, hash32, pick, seededRandom } from './random';

const draw = (seed: number, stream: string, n = 5) => {
  const random = seededRandom(seed, stream);
  return Array.from({ length: n }, () => random());
};

describe('seeded randomness', () => {
  it('hashes text to a stable unsigned 32-bit number', () => {
    expect(hash32('')).toBe(0x811c9dc5);
    expect(hash32('acme/app')).toBe(hash32('acme/app'));
    expect(hash32('acme/app')).not.toBe(hash32('acme/api'));
    expect(hash32('a'.repeat(100))).toBeGreaterThanOrEqual(0);
  });

  it('repeats a stream for its seed, and differs by stream and seed', () => {
    expect(draw(1, 'x')).toEqual(draw(1, 'x'));
    expect(draw(1, 'x')).not.toEqual(draw(1, 'y'));
    expect(draw(1, 'x')).not.toEqual(draw(2, 'x'));
    const many = draw(3, 'spread', 2000);
    expect(Math.min(...many)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...many)).toBeLessThan(1);
    // Spread over the range, not clumped.
    expect(many.filter((x) => x < 0.5).length).toBeGreaterThan(900);
    expect(many.filter((x) => x < 0.5).length).toBeLessThan(1100);
  });

  it('draws whole milliseconds within a range, and picks from a list', () => {
    expect(between(() => 0, [10, 20])).toBe(10);
    expect(between(() => 0.999_999, [10, 20])).toBe(20);
    expect(between(() => 0.5, [10, 20])).toBe(15);
    expect(pick(() => 0, ['a', 'b', 'c'])).toBe('a');
    expect(pick(() => 0.99, ['a', 'b', 'c'])).toBe('c');
  });
});
