/**
 * The theme (spec.md C-14): System follows the OS light/dark setting,
 * live; Light and Dark are fixed. Applied as the `dark` class and the
 * `color-scheme` on the root element.
 *
 * @module
 */
import type { ThemeChoice } from '@/domain/config/devicePreferences';

const QUERY = '(prefers-color-scheme: dark)';

type OnChange = (e: { matches: boolean }) => void;

/** The part of the OS `prefers-color-scheme` query the theme uses; a
 * `MediaQueryList` is one. */
export interface ThemeMedia {
  matches: boolean;
  addEventListener(type: 'change', listener: OnChange): void;
  removeEventListener(type: 'change', listener: OnChange): void;
}

/** Apply `choice` to `root` now, following the OS while it is System;
 * returns a function that stops following it. */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
  media: ThemeMedia = window.matchMedia(QUERY),
): () => void {
  const apply = (dark: boolean) => {
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  };
  if (choice !== 'system') {
    apply(choice === 'dark');
    return () => undefined;
  }
  apply(media.matches);
  const onChange: OnChange = (e) => {
    apply(e.matches);
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}
