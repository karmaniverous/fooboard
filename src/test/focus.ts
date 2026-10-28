/**
 * Test helper: focus an element inside `act(...)`. A bare `element.focus()`
 * runs React's focus handlers (a tooltip opening, roving focus moving, the
 * board's cell tip) outside act, so their state updates render after the
 * test has moved on, with React's act warning.
 *
 * @module
 */
import { act } from '@testing-library/react';

/** What Tab can reach, in document order (no positive tabindex is used). */
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Press Tab: focus the next element Tab reaches after `from` (or the
 * first), as the browser would; returns it. */
export function tab(
  from: Element | null = document.activeElement,
): HTMLElement {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)];
  const next = all.find(
    (el) =>
      !from ||
      from === document.body ||
      Boolean(
        from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  );
  if (!next) throw new Error('nothing more for Tab to reach');
  focusElement(next);
  return next;
}

/** Focus `element` and let React render what its focus handlers set. */
export function focusElement(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}
