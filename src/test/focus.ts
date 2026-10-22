/**
 * Test helper: focus an element inside `act(...)`. A bare `element.focus()`
 * runs React's focus handlers (a tooltip opening, roving focus moving, the
 * board's cell tip) outside act, so their state updates render after the
 * test has moved on, with React's act warning.
 *
 * @module
 */
import { act } from '@testing-library/react';

/** Focus `element` and let React render what its focus handlers set. */
export function focusElement(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}
