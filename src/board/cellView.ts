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

/** Empty states at rung 0 (icons only): a short symbol; the label is in
 * the tooltip, the accessible name and the detail sheet. */
export const EMPTY_SYMBOL: Record<EmptyCellState, string> = {
  'no-branch': '–',
  'no-recent-runs': '○',
  'needs-credential': '?',
  error: '!',
};

/** Badge text: a count when behind, `behind/ahead` when diverged. */
/** Counts above this show as "99+"; the tooltip has the exact numbers. */
const BADGE_CAP = 99;
const capCount = (n: number) =>
  n > BADGE_CAP ? `${String(BADGE_CAP)}+` : String(n);

export function badgeText(badge: NonNullable<StalenessBadge>): string {
  return badge.kind === 'behind'
    ? capCount(badge.count)
    : `${capCount(badge.behind)}/${capCount(badge.ahead)}`;
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
