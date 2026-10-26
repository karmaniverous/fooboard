/**
 * For tests: a window at a URL for `takeShareLink`, whose
 * `history.replaceState` really changes the URL.
 *
 * @module
 */
import { vi } from 'vitest';

import type { LinkWindow } from '@/share/link';

/** A window at `url`, whose `replaceState` really changes the URL. */
export function windowAt(url: string): LinkWindow & { url: URL } {
  const at = { url: new URL(url) };
  return {
    get url() {
      return at.url;
    },
    location: {
      get hash() {
        return at.url.hash;
      },
    },
    history: {
      state: { idx: 0 },
      // `takeShareLink` always passes where to go.
      replaceState: vi.fn((_state: unknown, _unused: string, to: string) => {
        at.url = new URL(to, at.url);
      }),
    },
  };
}
