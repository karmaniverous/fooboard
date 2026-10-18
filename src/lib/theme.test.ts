/**
 * Tests for the theme (spec.md C-14): System follows the OS until stopped;
 * Light and Dark ignore it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { fakeMedia } from '@/test/fakeMedia';

import { applyTheme } from './theme';

describe('applyTheme', () => {
  it('follows the OS while System, until stopped', () => {
    const root = document.createElement('html');
    const media = fakeMedia(true);
    const stop = applyTheme('system', root, media.media);
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
    applyTheme(choice, root, media.media);
    media.set(!dark);
    expect(root.classList.contains('dark')).toBe(dark);
  });
});
