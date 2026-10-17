/**
 * Whether a flex-wrap container's children have wrapped onto more than one
 * line, kept current as it resizes. Used to centre the board header and
 * toolbar once they wrap (spec.md C-13). Centring never changes where a
 * flex line breaks, so the result cannot feed back into itself.
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

/** Do these elements sit on more than one line? Items on one line may
 * differ in height (and so in top), so a child has wrapped only when it
 * starts at or below the bottom of the highest child. */
export function hasWrapped(children: readonly HTMLElement[]): boolean {
  if (children.length < 2) return false;
  const firstBottom = Math.min(
    ...children.map((c) => c.offsetTop + c.offsetHeight),
  );
  return children.some((c) => c.offsetTop >= firstBottom - 1);
}

export function useWrapped<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T>(null);
  const [wrapped, setWrapped] = useState(false);
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setWrapped(hasWrapped([...el.children] as HTMLElement[]));
  }, []);
  // Content changes (counts, the budget counter appearing) can wrap the
  // line without resizing the container, so re-check after every render;
  // an unchanged result does not re-render.
  useLayoutEffect(update);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update]);
  return [ref, wrapped];
}
