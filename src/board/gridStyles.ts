/**
 * Shared board-grid styles: the board's text and gear sizes, group label
 * text, and the lines drawn at group boundaries and round column groups
 * (spec.md C-14b).
 *
 * @module
 */
import { type Layout, LINE_HEIGHT } from './layout';
import {
  HEADER_GEAR_GAP,
  SETTINGS_GEAR_INSET,
  SETTINGS_GEAR_SIZE,
} from './settingsGearSize';

/** The board's text size and its settings gears' sizes (spec.md §3.11),
 * in ems of the text so they scale with zoom: set around the grid, so the
 * grid and the cell gear beside it share them. */
export const boardTextStyle = (layout: Layout): React.CSSProperties =>
  ({
    fontSize: `${String(layout.fontPx)}px`,
    lineHeight: LINE_HEIGHT,
    '--gear-size': `${String(SETTINGS_GEAR_SIZE * layout.fontPx)}px`,
    '--gear-inset': `${String(SETTINGS_GEAR_INSET * layout.fontPx)}px`,
    '--gear-gap': `${String(HEADER_GEAR_GAP * layout.fontPx)}px`,
  }) as React.CSSProperties;

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
