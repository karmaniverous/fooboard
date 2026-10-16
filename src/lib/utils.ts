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
