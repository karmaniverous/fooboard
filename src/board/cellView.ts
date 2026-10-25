/**
 * How a cell looks (spec.md §3, §4.3.5, C-13): status icons and labels,
 * the detail level a cell's rendered size allows, badge text, and relative
 * time. Pure, so the rules are tested without rendering.
 *
 * @module
 */
import type { StatusIcon } from '@/domain/config/statusSets';
import type { EmptyCellState } from '@/domain/derivation';
import type { StalenessBadge } from '@/domain/derivation';
import type { ResolvedStatus } from '@/domain/statuses/resolved';
import { textOn } from '@/lib/contrast';

/** How a status fills a cell or a legend swatch: its colour, text in white
 * or near-black (whichever reads, WCAG AA), and a dashed outline when
 * outlined. */
export const statusLook = (
  status: Pick<ResolvedStatus, 'color' | 'outlined'>,
): { className: string | undefined; style: React.CSSProperties } => ({
  className: status.outlined
    ? 'border border-dashed border-slate-500'
    : undefined,
  style: { backgroundColor: status.color, color: textOn(status.color) },
});

/** The key that opens a focused cell's detail sheet (Enter follows the
 * link): `key` as `KeyboardEvent.key` reports it, `name` as
 * `aria-keyshortcuts` and the tooltip's hint spell it. Empty cells are
 * buttons, which open the sheet on it natively. */
export const DETAILS_KEY = { key: ' ', name: 'Space' } as const;

/** The glyph for each status icon (A§4.3.6). */
export const STATUS_GLYPH: Record<StatusIcon, string> = {
  queued: '\u25cb',
  running: '\u25d4',
  partial: '\u25d1',
  success: '\u2713',
  failure: '\u2715',
  cancelled: '\u2298',
  unknown: '?',
};

/** Text shown in an empty cell (spec.md §4.3.5). */
export const EMPTY_LABEL: Record<EmptyCellState, string> = {
  'no-records': 'no records',
  'needs-credential': 'needs credential',
  error: 'error',
  'no-app': 'no app',
};

/** Empty states at rung 0 (icons only): a short symbol; the label is in
 * the tooltip, the accessible name and the detail sheet. */
export const EMPTY_SYMBOL: Record<EmptyCellState, string> = {
  'no-records': '○',
  'needs-credential': '?',
  error: '!',
  'no-app': '\u2205',
};

/** Badge text: a count when behind, `behind/ahead` when diverged. */
/** Counts above this show as "99+"; the tooltip has the exact numbers. */
export const BADGE_CAP = 99;
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
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

export function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.round((now - Date.parse(iso)) / MS_PER_SECOND),
  );
  if (seconds < SECONDS_PER_MINUTE) return 'now';
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${String(hours)}h`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) return `${String(days)}d`;
  return `${String(Math.floor(days / DAYS_PER_WEEK))}w`;
}

/** How many characters of a commit hash the board shows. */
export const SHORT_SHA_LENGTH = 7;

/** Short commit hash. */
export const shortSha = (sha: string): string => sha.slice(0, SHORT_SHA_LENGTH);

/** The first line of a commit message. */
/** A cell's place (row and stage): the tooltip's heading and the detail
 * sheet's title. */
export const cellPlace = ({
  rowName,
  stageName,
}: {
  rowName: string;
  stageName: string;
}): string => `${rowName} · ${stageName}`;

export const firstLine = (message: string): string =>
  message.split('\n', 1)[0]?.trim() ?? '';
