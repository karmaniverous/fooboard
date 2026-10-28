/**
 * The board's grid area (spec.md C-13; Decision 76), measured from the
 * window.
 *
 * @module
 */
import { useEffect, useState } from 'react';

import { mediaMatches } from '@/components/useMediaQuery';

/** The space kept below the grid (px), so its last row clears the
 * window's edge. */
const BOTTOM_MARGIN_PX = 8;

/** A touch-first device, whose browser shows and hides its own toolbars
 * (iOS's address bar) as the page scrolls. This is the primary pointer: a
 * touch-first device whose window can be resized (a tablet's split view)
 * also re-lays out only when the width or the orientation changes. */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** The viewport in landscape. */
const LANDSCAPE_QUERY = '(orientation: landscape)';

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

/** The viewport the layout is sized for. */
interface Viewport {
  width: number;
  height: number;
  landscape: boolean;
}

/**
 * The viewport's height for the layout: the small viewport height
 * (`100svh`, the probe's height), the height with the browser's toolbars
 * shown. `window.innerHeight` follows iOS's address bar as it collapses
 * and expands during a scroll; a layout sized from it changes the page's
 * height under the scroll, which moves the address bar again, and the
 * board vibrates (#47). Where the probe can't be measured (no `svh`, or
 * a test DOM), the window's height.
 */
const viewportHeight = (probe: HTMLElement | null): number =>
  probe?.getBoundingClientRect().height || window.innerHeight;

/**
 * The viewport to lay out for now. On a touch-first device the height is
 * kept until the width or the orientation changes, so nothing a scroll
 * does (toolbars, a keyboard) re-lays out the board; on a desktop every
 * resize counts, as before.
 */
function nextViewport(
  last: Viewport | null,
  measured: Viewport,
  coarse: boolean,
): Viewport {
  const same =
    last !== null &&
    last.width === measured.width &&
    last.landscape === measured.landscape;
  return coarse && same ? last : measured;
}

/** The grid area (C-13): the window's width less the page's side margins
 * (and less a scrollbar a modal has hidden, so opening one never widens
 * and re-lays out the board under it), and the viewport's height (above)
 * below the grid's top when the page is scrolled to the top. Both come
 * from the window, never from the grid's own size: the page grows with a
 * wide grid, so measuring the grid would feed each layout back into the
 * next and never settle. `probe` is an element `100svh` tall. */
export function useAreaSize(
  ref: React.RefObject<HTMLElement | null>,
  probe: React.RefObject<HTMLElement | null>,
): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let viewport: Viewport | null = null;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      viewport = nextViewport(
        viewport,
        {
          width: document.documentElement.clientWidth - removedScrollbar(),
          height: viewportHeight(probe.current),
          landscape: mediaMatches(LANDSCAPE_QUERY),
        },
        mediaMatches(COARSE_POINTER_QUERY),
      );
      const width = Math.max(0, viewport.width - 2 * left);
      const height = Math.max(0, viewport.height - top - BOTTOM_MARGIN_PX);
      setSize((last) =>
        last.width === width && last.height === height
          ? last
          : { width, height },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref, probe]);
  return size;
}
