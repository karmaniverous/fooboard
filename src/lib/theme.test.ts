/**
 * Tests for the theme (spec.md C-14): System follows the OS until stopped;
 * Light and Dark ignore it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { applyTheme } from './theme';

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

const asMedia = (m: ReturnType<typeof fakeMedia>) =>
  m as unknown as MediaQueryList;

describe('applyTheme', () => {
  it('follows the OS while System, until stopped', () => {
    const root = document.createElement('html');
    const media = fakeMedia(true);
    const stop = applyTheme('system', root, asMedia(media));
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    media.set(false);
    expect(root.classList.contains('dark')).toBe(false);
    stop();
    media.set(true);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('keeps %s whatever the OS says', (choice, dark) => {
    const root = document.createElement('html');
    const media = fakeMedia(!dark);
    applyTheme(choice, root, asMedia(media));
    media.set(!dark);
    expect(root.classList.contains('dark')).toBe(dark);
  });
});
