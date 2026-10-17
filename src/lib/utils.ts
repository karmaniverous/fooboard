/**
 * Shared UI utilities: `cn()` merges conditional class names (clsx) and
 * resolves Tailwind class conflicts (tailwind-merge), matching the
 * jeeves-server client's `src/lib/utils.ts` so the copied UI components
 * work unchanged.
 *
 * @module
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names, resolving Tailwind conflicts in favor of the last one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Page chrome stays pinned while a wide board scrolls the window sideways
 * (spec.md C-13). `--vw` is the window's width without its scrollbar, kept
 * current by `useViewportWidthVar`.
 */
export const PINNED_FULL = 'sticky left-0 w-[var(--vw,100vw)]';
/** As PINNED_FULL, for content inset by the page's 1rem side padding. */
export const PINNED_X = 'sticky left-4 w-[calc(var(--vw,100vw)-2rem)]';
