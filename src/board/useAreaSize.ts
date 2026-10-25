/**
 * The board's grid area (spec.md C-13), measured from the window.
 *
 * @module
 */
import { useEffect, useState } from 'react';

/** The width of the page's scrollbar while a modal (a panel, a sheet,
 * the settings popup) has hidden it to lock scrolling: the scroll lock
 * the library's modals use (`react-remove-scroll-bar`) records it on
 * `body` as `--removed-body-scroll-bar-size`. 0 when nothing is locked. */
const removedScrollbar = (): number =>
  parseFloat(
    getComputedStyle(document.body).getPropertyValue(
      '--removed-body-scroll-bar-size',
    ),
  ) || 0;

/** The grid area (C-13): the window's width less the page's side margins
 * (and less a scrollbar a modal has hidden, so opening one never widens
 * and re-lays out the board under it), and the window height below the
 * grid's top when the page is scrolled to the top. Both come from the window, never from the grid's own size:
 * the page grows with a wide grid, so measuring the grid would feed each
 * layout back into the next and never settle. */
export function useAreaSize(ref: React.RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      const windowWidth =
        document.documentElement.clientWidth - removedScrollbar();
      setSize({
        width: Math.max(0, windowWidth - 2 * left),
        height: Math.max(0, window.innerHeight - top - 8),
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref]);
  return size;
}
