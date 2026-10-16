/**
 * Vitest global setup: loads Testing Library's jest-dom matchers.
 *
 * @module
 */
import '@testing-library/jest-dom/vitest';

// jsdom lacks ResizeObserver; the board measures cells with it.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
