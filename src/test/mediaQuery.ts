/**
 * Test helper: replace `window.matchMedia` with queries the test controls.
 * `matching` says which queries match; `set` changes that and tells every
 * listener, as the browser does when the viewport changes. `restore` puts
 * the setup's stub back. jsdom has no `matchMedia` of its own.
 *
 * @module
 */
export interface FakeMediaQueries {
  /** Listeners currently subscribed, across queries. */
  listeners: ReadonlySet<() => void>;
  /** Change which queries match, and notify. */
  set: (matching: (query: string) => boolean) => void;
  restore: () => void;
}

export function fakeMediaQueries(
  matching: (query: string) => boolean,
): FakeMediaQueries {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const listeners = new Set<() => void>();
  let matches = matching;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return matches(query);
      },
      media: query,
      addEventListener: (_: string, l: () => void) => {
        listeners.add(l);
      },
      removeEventListener: (_: string, l: () => void) => {
        listeners.delete(l);
      },
    }),
  });
  return {
    listeners,
    set(next) {
      matches = next;
      for (const l of listeners) l();
    },
    restore() {
      if (original) Object.defineProperty(window, 'matchMedia', original);
    },
  };
}

/** A `matching` for `fakeMediaQueries`: a viewport this many px wide,
 * as far as `(width < Npx)` queries go (others don't match). */
export const viewportWidth =
  (px: number) =>
  (query: string): boolean => {
    const below = /^\(width < (\d+)px\)$/.exec(query)?.[1];
    return below !== undefined && px < Number(below);
  };

/** Run `fn` in a browser without `matchMedia`, then put it back. */
export function withoutMatchMedia(fn: () => void): void {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: undefined,
  });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(window, 'matchMedia', original);
  }
}
