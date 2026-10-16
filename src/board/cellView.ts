/**
 * How a cell looks (spec.md §3, §4.3.5, C-13): status icons and labels,
 * the detail level a cell's rendered size allows, badge text, and relative
 * time. Pure, so the rules are tested without rendering.
 *
 * @module
 */
import type { CellStatus, EmptyCellState } from '@/domain/derivation';
import type { StalenessBadge } from '@/domain/derivation';

/** Icon and label per status (spec.md §3). */
export const STATUS_META: Record<CellStatus, { icon: string; label: string }> =
  {
    queued: { icon: '\u25cb', label: 'Queued' },
    started: { icon: '\u25d4', label: 'Started' },
    partialSuccess: { icon: '\u25d1', label: 'Partial' },
    success: { icon: '\u2713', label: 'Success' },
    failure: { icon: '\u2715', label: 'Failure' },
    cancelled: { icon: '\u2298', label: 'Cancelled' },
  };

/** Text shown in an empty cell (spec.md §4.3.5). */
export const EMPTY_LABEL: Record<EmptyCellState, string> = {
  'no-branch': 'no branch',
  'no-recent-runs': 'no recent runs',
  'needs-credential': 'needs credential',
  error: 'error',
};

/** Detail levels, smallest first (spec.md C-13): 1 icon and badge; 2 adds
 * relative time; 3 adds the status label; 4 adds commit and phase. */
export type DetailLevel = 1 | 2 | 3 | 4;

/** Minimum cell width, in ems of the cell's font, for each level, per row
 * height. Full cells put time, commit and phase on a second line, so they
 * need less width. Tuned against the demo board; revisited with real boards
 * (step 17). */
const EMS_FOR_LEVEL = {
  compact: [0, 5.3, 10, 15.8],
  full: [0, 4.7, 8, 12.5],
} as const;

/** The detail level a cell `width` px wide shows at font size `fontPx`. */
export function detailLevel(
  width: number,
  fontPx: number,
  rowHeight: 'compact' | 'full',
): DetailLevel {
  const ems = width / fontPx;
  let level: DetailLevel = 1;
  for (const [i, min] of EMS_FOR_LEVEL[rowHeight].entries()) {
    if (ems >= min) level = (i + 1) as DetailLevel;
  }
  return level;
}

/** Font bounds for the grid: readable at the bottom, not shouting at the top. */
const MIN_FONT_PX = 7;
const MAX_FONT_PX = 13;

/** The grid's font size for a measured cell height (spec.md C-13). Rows
 * shrink to fit the viewport, and text shrinks with them: one line fills
 * ~60% of a Compact cell, two lines ~70% of a Full one. */
export function fitFontSize(
  cellHeight: number,
  rowHeight: 'compact' | 'full',
): number {
  const px = cellHeight * (rowHeight === 'full' ? 0.33 : 0.6);
  return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, px));
}

/** Badge text: a count when behind, `behind/ahead` when diverged. */
export function badgeText(badge: NonNullable<StalenessBadge>): string {
  return badge.kind === 'behind'
    ? String(badge.count)
    : `${String(badge.behind)}/${String(badge.ahead)}`;
}

/** Badge description for tooltips and screen readers. */
export function badgeDescription(badge: NonNullable<StalenessBadge>): string {
  return badge.kind === 'behind'
    ? `${String(badge.count)} commits behind its source`
    : `diverged: ${String(badge.behind)} behind, ${String(badge.ahead)} ahead of its source`;
}

/** Compact relative time: `now`, `4m`, `3h`, `2d`, `5w`. */
export function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d`;
  return `${String(Math.floor(days / 7))}w`;
}

/** Short commit hash. */
export const shortSha = (sha: string): string => sha.slice(0, 7);
