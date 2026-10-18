/**
 * The theme (spec.md C-14): System follows the OS light/dark setting,
 * live; Light and Dark are fixed. Applied as the `dark` class and the
 * `color-scheme` on the root element.
 *
 * @module
 */
import type { ThemeChoice } from '@/domain/config/devicePreferences';

const QUERY = '(prefers-color-scheme: dark)';

type Media = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
>;

/** The order the theme button cycles through. */
const THEME_CYCLE: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** The choice after `choice` in the cycle. */
export const nextTheme = (choice: ThemeChoice): ThemeChoice =>
  THEME_CYCLE[(THEME_CYCLE.indexOf(choice) + 1) % THEME_CYCLE.length] ??
  'system';

/** Apply `choice` to `root` now, following the OS while it is System;
 * returns a function that stops following it. */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
  media: Media = window.matchMedia(QUERY),
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
  const onChange = (e: MediaQueryListEvent) => {
    apply(e.matches);
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}
