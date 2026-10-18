/**
 * The theme follows the OS light/dark setting (spec.md C-14): the `dark`
 * class on the root element, kept in step with `prefers-color-scheme`.
 *
 * @module
 */

const QUERY = '(prefers-color-scheme: dark)';

/** Apply the OS theme to `root` now and whenever it changes; returns a
 * function that stops following it. */
export function followSystemTheme(
  root: HTMLElement = document.documentElement,
  media: Pick<
    MediaQueryList,
    'matches' | 'addEventListener' | 'removeEventListener'
  > = window.matchMedia(QUERY),
): () => void {
  const apply = (dark: boolean) => {
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  };
  apply(media.matches);
  const onChange = (e: MediaQueryListEvent) => {
    apply(e.matches);
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}
