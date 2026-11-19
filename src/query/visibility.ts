/**
 * Whether the tab is visible (spec §3.L, Decision 113), as a port the
 * board model depends on. `tabVisibility` reads TanStack's `focusManager`,
 * which follows `document.visibilityState` (and any `setFocused` a test
 * makes): the same notion TanStack's own focus refetch uses, so the board
 * changes its cadence on exactly the event that re-reads what is due.
 *
 * @module
 */
import { focusManager } from '@tanstack/query-core';

/** The tab's visibility, and its changes. */
export interface Visibility {
  isVisible(): boolean;
  /** Hear every change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** The tab's own visibility. */
export const tabVisibility: Visibility = {
  isVisible: () => focusManager.isFocused(),
  subscribe: (listener) =>
    focusManager.subscribe(() => {
      listener();
    }),
};
