/**
 * Tests for `describeError`.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { describeError } from './errors';

describe('describeError', () => {
  it('keeps the error name and message', () => {
    const err = new Error('App d1 not found');
    err.name = 'NotFoundException';
    expect(describeError(err)).toBe('NotFoundException: App d1 not found');
  });

  it('stringifies non-Error values', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(42)).toBe('42');
  });
});
