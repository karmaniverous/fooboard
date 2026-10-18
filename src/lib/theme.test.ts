/**
 * Tests for following the OS theme (spec.md C-14): the root gets `dark`
 * when the OS is dark, follows changes, and stops when asked.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { followSystemTheme } from './theme';

/** A controllable `prefers-color-scheme` query. */
function fakeMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  return {
    matches,
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
      listeners.add(l);
    },
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
      listeners.delete(l);
    },
    set(dark: boolean) {
      for (const l of listeners) l({ matches: dark } as MediaQueryListEvent);
    },
  };
}

describe('followSystemTheme', () => {
  it('applies the OS theme and follows its changes until stopped', () => {
    const root = document.createElement('html');
    const media = fakeMedia(true);
    const stop = followSystemTheme(root, media as unknown as MediaQueryList);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    media.set(false);
    expect(root.classList.contains('dark')).toBe(false);
    stop();
    media.set(true);
    expect(root.classList.contains('dark')).toBe(false);
  });
});
