/**
 * Tests for `useMediaQuery`: it reads the query's match, follows its
 * changes, lets go of its listener, and is false where `matchMedia` is
 * missing.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fakeMediaQueries, withoutMatchMedia } from '@/test/mediaQuery';

import { useMediaQuery } from './useMediaQuery';

const NARROW = '(width < 640px)';

describe('useMediaQuery', () => {
  it('reads and follows the query, letting go when unmounted', () => {
    const media = fakeMediaQueries(() => false);
    try {
      const { result, unmount } = renderHook(() => useMediaQuery(NARROW));
      expect(result.current).toBe(false);
      act(() => {
        media.set((q) => q === NARROW);
      });
      expect(result.current).toBe(true);
      expect(media.listeners.size).toBe(1);
      unmount();
      expect(media.listeners.size).toBe(0);
    } finally {
      media.restore();
    }
  });

  it('is false where matchMedia is missing', () => {
    withoutMatchMedia(() => {
      const { result } = renderHook(() => useMediaQuery(NARROW));
      expect(result.current).toBe(false);
    });
  });
});
