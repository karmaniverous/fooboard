/**
 * The user-facing docs offer *Reset* now that it is built (spec.md §3.9,
 * N3, reversing N1a's guard): README and PRIVACY.md name it as the way to
 * remove everything fooboard keeps, and say what the persisted cache keeps
 * and for how long (§3.4).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { CLEAR_EVERYTHING_STEPS } from '@/test/refusingDevice';

import privacy from '../PRIVACY.md?raw';
import readme from '../README.md?raw';

describe('docs', () => {
  it.each([
    ['README.md', readme],
    ['PRIVACY.md', privacy],
  ])('%s offers Reset and says what is cached, for how long', (_name, text) => {
    expect(text).toMatch(CLEAR_EVERYTHING_STEPS);
    expect(text).toMatch(/unencrypted/);
    expect(text).toMatch(/24 hours/);
  });
});
