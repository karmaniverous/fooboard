/**
 * Tests for `describeError`.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { describeError, errorMessage } from './errors';

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

describe('errorMessage', () => {
  it('drops the error name', () => {
    const err = new Error('App d1 not found');
    err.name = 'NotFoundException';
    expect(errorMessage(err)).toBe('App d1 not found');
  });

  it('falls back to the name when there is no message', () => {
    const err = new Error();
    err.name = 'NotFoundException';
    expect(errorMessage(err)).toBe('NotFoundException');
  });

  it('stringifies non-Error values', () => {
    expect(errorMessage('boom')).toBe('boom');
  });
});
