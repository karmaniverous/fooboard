/**
 * Whether the user asks for reduced motion
 * (`prefers-reduced-motion: reduce`), following changes. False where the query isn't available.
 *
 * @module
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const media = (): MediaQueryList | undefined =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : undefined;

const subscribe = (onChange: () => void): (() => void) => {
  const list = media();
  list?.addEventListener('change', onChange);
  return () => {
    list?.removeEventListener('change', onChange);
  };
};

const snapshot = (): boolean => media()?.matches ?? false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
