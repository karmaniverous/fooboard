/**
 * Keeps the `--vw` CSS variable equal to the window's width without its
 * scrollbar, so pinned page chrome (`PINNED_FULL`, `PINNED_X`) spans the
 * window exactly while a wide board scrolls it sideways (spec.md C-13).
 *
 * @module
 */
import { useEffect } from 'react';

export function useViewportWidthVar(): void {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--vw', `${String(root.clientWidth)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
}
