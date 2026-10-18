/**
 * Vitest global setup: loads Testing Library's jest-dom matchers.
 *
 * @module
 */
import '@testing-library/jest-dom/vitest';

// jsdom lacks pointer capture and scrollIntoView, which Radix's Select
// calls when it opens.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
});

// jsdom lacks matchMedia (the theme follows prefers-color-scheme).
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});

// jsdom lacks ResizeObserver; the board measures cells with it.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
