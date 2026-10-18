/**
 * Fake layout for measured components in jsdom (which lays nothing out):
 * a width for one container tag, and a box for any element by a callback.
 *
 * @module
 */
import { vi } from 'vitest';

export function fakeLayout(
  container: { tag: string; width: number },
  box: (el: Element) => { left?: number; width?: number; height?: number },
): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === container.tag ? container.width : 0;
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const { left = 0, width = 0, height = 0 } = box(this);
      return {
        left,
        width,
        height,
        top: 0,
        right: left + width,
        bottom: height,
        x: left,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
}
