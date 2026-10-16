/**
 * Tests for `cn()`: conditional composition and Tailwind conflict
 * resolution.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { cn } from './utils';

/** Returns `false`, without a literal type TypeScript can narrow away. */
function alwaysFalse(): boolean {
  return Date.now() < 0;
}

describe('cn', () => {
  it('joins plain string class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', alwaysFalse() && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('applies object-form conditionals', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });

  it('resolves conflicting Tailwind utility classes in favor of the last one', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
