/**
 * One board cell (spec.md §3, §4.3.5, C-13, C-13a): a solid block of its
 * status colour showing the board's detail rung packed by the board's line
 * map, or an empty state. Every cell on the board gets the same rung and
 * arrangement; rung 0 shows only the icon and badge.
 *
 * The whole cell is a link to the job (or Amplify console) laid under its
 * text (`CellCover`): a click or Enter follows it, a touch tap or Space
 * opens the detail sheet; a record with no link gets a button instead,
 * which opens the sheet, as an empty cell does. The behind/diverged badge
 * is a separate link to the compare page, placed above it (links can't
 * nest). The cover's accessible name carries status, time and badge,
 * whatever the rung shows.
 *
 * Hover and focus are heard on the cell's box, which holds the cover and
 * the badge, so moving onto the badge keeps the cell's tooltip; a leave
 * says where the pointer or focus went, so the board keeps the tooltip
 * when it went to the cell's gear (`withinCell`, issue #42).
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import type { BoardCell } from '@/engine';
import { cn } from '@/lib/utils';

import { CELL_CONTROL } from './cellBox';
import { CellCover } from './CellCover';
import { type Keyed, Lines } from './CellLines';
import { markedLook, markWords } from './cellMarks';
import { gapStyle } from './cellStyles';
import {
  badgeDescription,
  badgeText,
  cellKeyshortcuts,
  EMPTY_LABEL,
  EMPTY_SYMBOL,
  firstLine,
  relativeTime,
  shortSha,
  STATUS_GLYPH,
  statusLook,
} from './cellView';
import { BADGE_STYLE, textSize } from './gridStyles';
import { type Rung, RUNG_SHOWS } from './layout';
import { type LineMap } from './packing';
import { RefreshingDot } from './RefreshingDot';

export interface CellProps {
  cell: BoardCell | undefined;
  rung: Rung;
  /** The board's line map: which line each item sits on (C-13). */
  lineOf: LineMap;
  now: number;
  /** Hover or focus entered the cell's box (`target`): show its
   * tooltip; or left it (`null`) for `to`. */
  onInspect?: (target: HTMLElement | null, to?: EventTarget | null) => void;
  /** Open the detail sheet: a touch tap or the details key (Space) on a
   * status cell, or any activation of an empty cell (which has no link to
   * follow). */
  onOpenSheet?: () => void;
  /** The board has a settings popup: the cell says `,` opens it. */
  settingsKey?: boolean;
}

/** Hover and focus handlers for the cell's box, showing its tooltip. */
interface Inspect {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => void;
  onFocus: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLElement>) => void;
}

const EMPTY_CLASS = {
  'no-records': 'border-dashed border-border',
  'needs-credential': 'border-border bg-hatched',
  error: 'border-border bg-hatched',
  'no-app': 'border-dashed border-border',
} as const;

/** Free text: cut off with an ellipsis at the column width. */
const Free = ({ children }: { children: string }) => (
  <span className="min-w-0 truncate">{children}</span>
);

export function Cell({
  cell,
  rung,
  lineOf,
  now,
  onInspect,
  onOpenSheet,
  settingsKey = false,
}: CellProps): React.JSX.Element {
  const inspect: Inspect = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      onInspect?.(e.currentTarget),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) =>
      onInspect?.(null, e.relatedTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => onInspect?.(e.currentTarget),
    onBlur: (e: React.FocusEvent<HTMLElement>) =>
      onInspect?.(null, e.relatedTarget),
  };
  const pad = 'px-[var(--cell-pad-x)] py-[var(--cell-pad-y)]';

  if (!cell) {
    return <div className="h-full rounded-md bg-muted/40" aria-busy />;
  }

  const { derivation, badge, compare } = cell;
  if (derivation.kind === 'empty') {
    const label = EMPTY_LABEL[derivation.state];
    const extra = derivation.reason;
    // A button, so every empty state can be reached and opened (keyboard,
    // tap, click).
    return (
      <button
        type="button"
        aria-label={extra ? `${label}: ${extra}` : label}
        aria-keyshortcuts={settingsKey ? cellKeyshortcuts(true) : undefined}
        className={cn(
          'flex h-full w-full items-center overflow-hidden rounded-md border text-left italic text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
          pad,
          EMPTY_CLASS[derivation.state],
        )}
        style={textSize('empty')}
        onClick={onOpenSheet}
        {...CELL_CONTROL}
        {...inspect}
      >
        <Lines
          lineOf={lineOf}
          center={rung === 0}
          lead={
            <span>{rung === 0 ? EMPTY_SYMBOL[derivation.state] : label}</span>
          }
          items={
            rung >= RUNG_SHOWS.branch && extra
              ? [{ key: 'extra', node: <Free>{extra}</Free>, free: true }]
              : []
          }
        />
      </button>
    );
  }

  const { status } = derivation;

  const { time, commit, branch, message } = derivation;
  const relative = time ? relativeTime(time, now) : undefined;

  const badgeLink = badge && (
    <ExternalLink
      unstyled
      href={compare?.htmlUrl}
      aria-label={badgeDescription(badge)}
      className={cn(
        // Coloured fill and solid border in the badge colour; nothing drawn
        // outside the border (C-13). Semibold, the weight the layout
        // measures; size, padding and border from `BADGE_STYLE`.
        'pointer-events-auto flex-none rounded-full font-semibold leading-[1.45] no-underline',
        badge.kind === 'behind'
          ? 'border-badge-behind bg-badge-behind text-badge-behind-text'
          : 'border-badge-diverged bg-badge-diverged text-badge-diverged-text',
      )}
      style={BADGE_STYLE}
    >
      {badgeText(badge)}
    </ExternalLink>
  );
  // From the commit rung the badge follows the commit it describes (C-13).
  const badgeAfterCommit = rung >= RUNG_SHOWS.commit && Boolean(commit);

  // Items are hidden from assistive tech (the cover link's name says it
  // all), except the badge link, which stays reachable.
  const items: Keyed[] = [];
  if (rung >= RUNG_SHOWS.time && time) {
    items.push({
      key: 'time',
      node: (
        <time aria-hidden dateTime={time}>
          {relative}
        </time>
      ),
    });
  }
  if (rung >= RUNG_SHOWS.commit) {
    if (commit) {
      items.push({
        key: 'commit',
        node: (
          <span className="flex items-center" style={gapStyle}>
            <span
              aria-hidden
              className="font-mono"
              style={textSize('sha')}
            >
              {shortSha(commit)}
            </span>
            {badgeLink}
          </span>
        ),
      });
    }
  }
  if (rung >= RUNG_SHOWS.branch && branch) {
    items.push({
      key: 'branch',
      node: <Free>{branch}</Free>,
      free: true,
    });
  }
  if (rung >= RUNG_SHOWS.message && message) {
    items.push({
      key: 'message',
      node: <Free>{firstLine(message)}</Free>,
      free: true,
    });
  }

  const name = [
    status.name,
    branch,
    relative && `${relative} ago`,
    badge && badgeDescription(badge),
    ...markWords(cell),
  ]
    .filter(Boolean)
    .join(', ');

  const look = markedLook(cell, statusLook(status));
  return (
    <div
      className={cn(
        'relative flex h-full overflow-hidden rounded-md font-medium',
        pad,
        look.className,
      )}
      style={look.style}
      {...inspect}
    >
      <CellCover
        href={derivation.linkUrl}
        name={name}
        onOpenSheet={onOpenSheet}
        settingsKey={settingsKey}
      />
      <RefreshingDot cell={cell} />
      {/* Text sits above the cover link but lets clicks through; the badge
          link inside it takes its own clicks. Text is hidden from assistive
          tech because the cover link's name already says it all. */}
      <span className="pointer-events-none relative flex min-w-0 flex-1 items-center">
        <Lines
          lineOf={lineOf}
          center={rung === 0}
          lead={
            <>
              <span
                aria-hidden
                className={cn(
                  'w-[1em] flex-none text-center',
                  // Still, with reduced motion (spec.md §3.10).
                  status.summary.inProgress && 'motion-safe:animate-pulse',
                )}
              >
                {STATUS_GLYPH[status.icon]}
              </span>
              {rung >= RUNG_SHOWS.name && (
                <span aria-hidden className="font-semibold">
                  {status.name}
                </span>
              )}
              {!badgeAfterCommit && badgeLink}
            </>
          }
          items={items}
        />
      </span>
    </div>
  );
}
