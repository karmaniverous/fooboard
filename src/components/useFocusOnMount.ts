/**
 * Focus an element when it first renders: a first-run step's heading
 * (spec.md §3.10, *first-run steps move focus to each step's heading*), so
 * a screen reader announces the new step and Tab continues from it.
 *
 * @module
 */
import { useEffect, useRef } from 'react';

/** A ref whose element takes focus once mounted. */
export function useFocusOnMount<
  T extends HTMLElement,
>(): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
