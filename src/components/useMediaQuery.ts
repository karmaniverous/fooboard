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

/** Whether `query` matches now (false without `matchMedia`). */
export const mediaMatches = (query: string): boolean =>
  media(query)?.matches ?? false;

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
    () => mediaMatches(query),
    () => false,
  );
}
