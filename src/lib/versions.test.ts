/**
 * Tests for semantic version order and the unseen-version rule behind
 * the *Release notes* dot (spec 0.2.0 §3.D).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { compareVersions, isUnseen } from './versions';

describe('compareVersions', () => {
  it.each([
    ['0.1.0', '0.1.0', 0],
    ['0.1.1', '0.1.0', 1],
    ['0.2.0', '0.1.9', 1],
    ['1.0.0', '0.99.99', 1],
    ['0.10.0', '0.9.0', 1],
    ['0.1.0', '0.1.0-0', 1],
    ['0.1.0-1', '0.1.0-0', 1],
    ['0.1.0-10', '0.1.0-9', 1],
    ['0.1.0-beta', '0.1.0-alpha', 1],
    ['0.1.0-alpha', '0.1.0-1', 1],
    ['0.1.0-alpha.1', '0.1.0-alpha', 1],
    ['0.1.0+build.2', '0.1.0+build.1', 0],
  ])('orders %s against %s as %i', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b) ?? Number.NaN)).toBe(sign);
    expect(Math.sign(compareVersions(b, a) ?? Number.NaN)).toBe(-sign || 0);
  });

  it.each([
    ['v0.1.0', '0.1.0'],
    ['0.1', '0.1.0'],
    ['0.1.0', 'next'],
  ])('has no order for %s and %s', (a, b) => {
    expect(compareVersions(a, b)).toBeUndefined();
  });
});

describe('isUnseen', () => {
  it.each([
    ['nothing seen yet', '0.1.0', undefined, true],
    ['this version seen', '0.1.0', '0.1.0', false],
    ['an older one seen', '0.2.0', '0.1.0', true],
    ['a newer one seen (an older site)', '0.1.0', '0.2.0', false],
    ['a prerelease seen, then its release', '0.1.0', '0.1.0-0', true],
    ['an unparsable seen value', '0.1.0', 'garbage', true],
    ['the same unparsable value', 'next', 'next', false],
  ])('%s', (_, version, lastSeen, unseen) => {
    expect(isUnseen(version, lastSeen)).toBe(unseen);
  });
});
