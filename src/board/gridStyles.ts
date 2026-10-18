/**
 * Shared board-grid styles: group label text and the lines drawn at group
 * boundaries and round column groups (spec.md C-14b).
 *
 * @module
 */

/** Group label text, over columns and above rows (C-14b). */
export const GROUP_LABEL =
  'text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground';

/** The line drawn at every group boundary, and a column group's frame
 * (C-14b). */
export const BOUNDARY = {
  top: 'border-t-2 border-foreground/40',
  left: 'border-l-2 border-foreground/40',
  right: 'border-r-2 border-foreground/40',
} as const;
