/**
 * Tests for `secondsToMs`: a header's seconds as milliseconds, nothing
 * for a missing, negative or non-finite value.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { secondsToMs } from './retryAfter';

describe('secondsToMs', () => {
  it.each([
    ['30', 30_000],
    ['0', 0],
    ['1.5', 1_500],
  ])('reads %s seconds as %i ms', (raw, ms) => {
    expect(secondsToMs(raw)).toBe(ms);
  });

  it.each([null, undefined, 5, '-1', 'Infinity', 'NaN', 'soon'])(
    'gives nothing for %s',
    (raw) => {
      expect(secondsToMs(raw)).toBeUndefined();
    },
  );
});
