/**
 * Tests for expiry warnings: quiet until the warning window, counts down
 * inside it, reports expiry, and ignores missing or unparseable dates.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { expiryWarning } from './expiry';

const now = Date.parse('2026-10-16T12:00:00Z');

describe('expiryWarning', () => {
  it.each([
    ['2026-12-01 00:00:00 UTC', undefined],
    ['2026-10-26 12:00:00 UTC', 'Expires in 10 days'],
    ['2026-10-17 12:00:00 UTC', 'Expires tomorrow'],
    ['2026-10-15 12:00:00 UTC', 'Expired'],
    ['2026-10-26', 'Expires in 10 days'],
    [undefined, undefined],
    ['not a date', undefined],
  ])('%s -> %s', (expiresAt, expected) => {
    expect(expiryWarning(expiresAt, now)).toBe(expected);
  });
});
