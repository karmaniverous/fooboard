/**
 * Vitest global setup: loads Testing Library's jest-dom matchers, fails
 * any test that logs a React act(...) warning, and fills jsdom gaps.
 *
 * @module
 */
import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach } from 'vitest';

import { assertNoActWarnings, watchActWarnings } from './actGuard';

// Registered before Testing Library's own cleanup, so (after hooks run in
// reverse) this checks once the test's tree has unmounted; afterAll catches
// a warning logged after a file's last test.
watchActWarnings();
afterEach(assertNoActWarnings);
afterAll(assertNoActWarnings);

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
