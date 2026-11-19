/**
 * Test helpers for scroll containers. jsdom doesn't apply Tailwind, so no
 * element scrolls; `applyOverflowUtility` gives `overflow-y-auto` its
 * value wherever `getComputedStyle` is read (by dnd-kit and by
 * `scrollContainerOf`), and `scrollContainerOf` finds the element that
 * scrolls a given one, as dnd-kit does when it autoscrolls a drag.
 *
 * @module
 */
import { getScrollableAncestors } from '@dnd-kit/core';
import { vi } from 'vitest';

/** The utility class that makes an element scroll vertically. */
const OVERFLOW_Y_AUTO = 'overflow-y-auto';

/** `style` as read, but computing `overflow-y` (in either spelling) to
 * `auto`. A computed style is read-only (jsdom 31, as in browsers), so
 * this wraps it rather than setting the property. */
function scrollingStyle(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, property) {
      if (property === 'overflowY') return 'auto';
      if (property === 'getPropertyValue')
        return (name: string) =>
          name === 'overflow-y' ? 'auto' : target.getPropertyValue(name);
      const value: unknown = Reflect.get(target, property, target);
      if (!(value instanceof Function)) return value;
      // A method, such as `item` or `getPropertyPriority`, on the real style.
      return (...args: unknown[]): unknown =>
        Reflect.apply(value, target, args);
    },
  });
}

/** Make `overflow-y-auto` compute to `overflow-y: auto`; returns the
 * restore. */
export function applyOverflowUtility(): () => void {
  const real = window.getComputedStyle.bind(window);
  const spy = vi
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((el, pseudo) => {
      const style = real(el, pseudo);
      return el.classList.contains(OVERFLOW_Y_AUTO)
        ? scrollingStyle(style)
        : style;
    });
  return () => {
    spy.mockRestore();
  };
}

/** The nearest ancestor of `el` that scrolls (the document's scrolling
 * element if none does). */
export function scrollContainerOf(el: Element): HTMLElement | null {
  const [container] = getScrollableAncestors(el, 1);
  return container instanceof HTMLElement ? container : null;
}
