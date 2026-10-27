/**
 * Tests for `plural`: 0 and 2+ take the plural, exactly 1 the singular.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { plural } from './plural';

describe('plural', () => {
  it.each([
    [0, '0 commits'],
    [1, '1 commit'],
    [2, '2 commits'],
    [100, '100 commits'],
  ])('counts %i as %s', (n, words) => {
    expect(plural(n, 'commit', 'commits')).toBe(words);
  });

  it('takes irregular forms as given', () => {
    expect(plural(1, 'run lands', 'runs land')).toBe('1 run lands');
    expect(plural(3, 'run lands', 'runs land')).toBe('3 runs land');
  });
});
