/**
 * Which header parts fold into the menu as the app header narrows
 * (spec.md C-19): buttons from the right, then the tagline, then README
 * and News & support. Pure, so it is tested without a browser.
 *
 * @module
 */
import type { NavId } from '@/components/navItems';

/** What folds first as the header narrows (C-19). */
export const FOLD_ORDER: readonly (NavId | 'tagline')[] = [
  'issue',
  'github',
  'import',
  'share',
  'theme',
  'demo',
  'tagline',
  'readme',
  'news',
];

/**
 * How many of FOLD_ORDER to fold: the fewest that let the row fit `room`,
 * given each part's natural width (`widths[id]`), the parts that never
 * fold (`fixed`: logo and name, the menu button) and the `gap` between
 * parts.
 */
export function foldCount(
  widths: Readonly<Partial<Record<NavId | 'tagline', number>>>,
  fixed: number,
  room: number,
  gap: number,
): number {
  for (let folded = 0; folded < FOLD_ORDER.length; folded++) {
    const shown = FOLD_ORDER.slice(folded).map((id) => widths[id] ?? 0);
    const width =
      fixed + shown.reduce((a, b) => a + b, 0) + (shown.length + 1) * gap;
    if (width <= room) return folded;
  }
  return FOLD_ORDER.length;
}
