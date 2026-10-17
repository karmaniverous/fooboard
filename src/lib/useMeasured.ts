/**
 * Choose a layout by measuring content, not by fixed breakpoints
 * (spec.md C-13). The caller's `measure` reads its container's width and
 * the natural widths of elements marked `data-measure` (live elements
 * that keep their natural width in every layout, or hidden copies), and
 * returns a layout value. Re-measured after every render and whenever the
 * container or a measured element resizes; an unchanged value does not
 * re-render. Measured elements must not change size with the result, so
 * the choice cannot feed back into itself.
 *
 * @module
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Natural width of the `data-measure="name"` element inside `root`. */
export function measuredWidth(root: HTMLElement, name: string): number {
  const el = root.querySelector<HTMLElement>(`[data-measure="${name}"]`);
  return el ? el.getBoundingClientRect().width : 0;
}

export function useMeasured<T extends HTMLElement, V>(
  measure: (container: T) => V,
  initial: V,
): [React.RefObject<T | null>, V] {
  const ref = useRef<T>(null);
  const measureRef = useRef(measure);
  const [value, setValue] = useState(initial);
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setValue(measureRef.current(el));
  }, []);
  useLayoutEffect(() => {
    measureRef.current = measure;
    update();
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const m of el.querySelectorAll('[data-measure]')) observer.observe(m);
    return () => {
      observer.disconnect();
    };
  }, [update]);
  return [ref, value];
}
