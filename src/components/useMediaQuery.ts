/**
 * Whether a CSS media query matches, following changes (`matchMedia`).
 * False where `matchMedia` isn't available.
 *
 * @module
 */
import { useCallback, useSyncExternalStore } from 'react';

const media = (query: string): MediaQueryList | undefined =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : undefined;

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const list = media(query);
      list?.addEventListener('change', onChange);
      return () => {
        list?.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => media(query)?.matches ?? false,
    () => false,
  );
}
