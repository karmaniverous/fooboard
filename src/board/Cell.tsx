/**
 * One board cell (spec.md §3, §4.3.5, C-13, C-13a): a solid block of its
 * status colour showing the board's detail rung packed by the board's line
 * map, or an empty state. Every cell on the board gets the same rung and
 * arrangement; rung 0 shows only the icon and badge.
 *
 * The whole cell is a link to the job (or Amplify console) laid under its
 * text; the behind/diverged badge is a separate link to the compare page,
 * placed above it (links can't nest). The cell link's accessible name
 * carries status, time and badge, whatever the rung shows.
 *
 * @module
 */
import { useRef } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import type { StatusColors } from '@/domain/config/colors';
import type { BoardCell } from '@/engine';
import { cn } from '@/lib/utils';

import {
  badgeDescription,
  badgeText,
  EMPTY_LABEL,
  EMPTY_SYMBOL,
  relativeTime,
  shortSha,
  STATUS_META,
} from './cellView';
import { ITEM_GAP_EM, type ItemKey, type LineMap, type Rung } from './layout';
import { firstLine } from './layoutContents';

export interface CellProps {
  cell: BoardCell | undefined;
  rung: Rung;
  /** The board's line map: which line each item sits on (C-13). */
  lineOf: LineMap;
  colors: StatusColors;
  now: number;
  /** Hover or focus: show the tooltip for this cell. */
  onInspect?: (target: HTMLElement | null) => void;
  /** Open the detail sheet: a touch tap on a status cell, or any activation
   * of an empty cell (which has no link to follow). */
  onOpenSheet?: () => void;
}

const EMPTY_CLASS = {
  'no-branch': 'border-dashed border-border/60',
  'no-recent-runs': 'border-dashed border-border',
  'needs-credential': 'border-border bg-hatched',
  error: 'border-border bg-hatched',
} as const;

const gapStyle = { gap: `${String(ITEM_GAP_EM)}em` };

type Keyed = { key: ItemKey; node: React.ReactNode; free?: boolean };

/** Arrange the lead and items by the board's line map (C-13): the lead on
 * line 0, each item on its line. Fixed items keep their width; free text
 * takes what is left and is cut off. */
function Lines({
  lineOf,
  lead,
  items,
  center = false,
}: {
  /** Centre the content horizontally (rung 0, icons only). */
  center?: boolean;
  lineOf: LineMap;
  lead: React.ReactNode;
  items: Keyed[];
}): React.JSX.Element {
  const line = 'flex min-w-0 items-center overflow-hidden whitespace-nowrap';
  const lines: React.ReactNode[][] = [[lead]];
  for (const item of items) {
    const n = lineOf[item.key] ?? 0;
    while (lines.length <= n) lines.push([]);
    lines[n]?.push(
      <span
        key={item.key}
        className={item.free ? 'flex min-w-0 flex-1' : 'flex flex-none'}
      >
        {item.node}
      </span>,
    );
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col justify-center">
      {lines.map((content, i) =>
        content.length === 0 ? null : (
          // Lines are positional and never reorder.
          <span
            key={i}
            className={cn(line, center && 'justify-center')}
            style={gapStyle}
          >
            {content}
          </span>
        ),
      )}
    </span>
  );
}

/** Free text: cut off with an ellipsis at the column width. */
const Free = ({ children }: { children: string }) => (
  <span className="min-w-0 truncate">{children}</span>
);

export function Cell({
  cell,
  rung,
  lineOf,
  colors,
  now,
  onInspect,
  onOpenSheet,
}: CellProps): React.JSX.Element {
  const touched = useRef(false);
  const inspect = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      onInspect?.(e.currentTarget),
    onMouseLeave: () => onInspect?.(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => onInspect?.(e.currentTarget),
    onBlur: () => onInspect?.(null),
  };
  const pad = 'px-[var(--cell-pad-x)] py-[var(--cell-pad-y)]';

  if (!cell) {
    return <div className="h-full rounded-md bg-muted/40" aria-busy />;
  }

  const { derivation, badge, compare } = cell;
  if (derivation.kind === 'empty') {
    const label = EMPTY_LABEL[derivation.state];
    const extra = derivation.reason ?? derivation.branch;
    // A button, so every empty state can be reached and opened (keyboard,
    // tap, click).
    return (
      <button
        type="button"
        aria-label={extra ? `${label}: ${extra}` : label}
        className={cn(
          'flex h-full w-full items-center overflow-hidden rounded-md border text-left text-[0.9em] italic text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
          pad,
          EMPTY_CLASS[derivation.state],
        )}
        onClick={onOpenSheet}
        {...inspect}
      >
        <Lines
          lineOf={lineOf}
          center={rung === 0}
          lead={
            <span>{rung === 0 ? EMPTY_SYMBOL[derivation.state] : label}</span>
          }
          items={
            rung >= 4 && extra
              ? [{ key: 'extra', node: <Free>{extra}</Free>, free: true }]
              : []
          }
        />
      </button>
    );
  }

  const { status } = derivation;
  const meta = STATUS_META[status];
  const queued = status === 'queued';
  const { time, commit, branch, message } = derivation;
  const relative = time ? relativeTime(time, now) : undefined;

  const badgeLink = badge && (
    <ExternalLink
      unstyled
      href={compare?.htmlUrl}
      aria-label={badgeDescription(badge)}
      className={cn(
        // Coloured fill and solid border in the badge colour; nothing drawn
        // outside the border (C-13).
        'pointer-events-auto flex-none rounded-full border-[1.5px] px-[0.45em] text-[0.8em] font-bold leading-[1.45] no-underline',
        badge.kind === 'behind'
          ? 'border-badge-behind bg-badge-behind text-badge-behind-text'
          : 'border-badge-diverged bg-badge-diverged text-badge-diverged-text',
      )}
    >
      {badgeText(badge)}
    </ExternalLink>
  );
  // From rung 3 the badge follows the commit it describes (C-13).
  const badgeAfterCommit = rung >= 3 && Boolean(commit);

  // Items are hidden from assistive tech (the cover link's name says it
  // all), except the badge link, which stays reachable.
  const items: Keyed[] = [];
  if (rung >= 2 && time) {
    items.push({
      key: 'time',
      node: (
        <time aria-hidden dateTime={time}>
          {relative}
        </time>
      ),
    });
  }
  if (rung >= 3) {
    if (commit) {
      items.push({
        key: 'commit',
        node: (
          <span className="flex items-center" style={gapStyle}>
            <span aria-hidden className="font-mono text-[0.95em] opacity-90">
              {shortSha(commit)}
            </span>
            {badgeLink}
          </span>
        ),
      });
    }
    items.push({
      key: 'phase',
      node: (
        <span
          aria-hidden
          className="rounded border border-current px-1 text-[0.85em]"
        >
          {derivation.phase}
        </span>
      ),
    });
  }
  if (rung >= 4 && branch) {
    items.push({
      key: 'branch',
      node: <Free>{branch}</Free>,
      free: true,
    });
  }
  if (rung >= 5 && message) {
    items.push({
      key: 'message',
      node: <Free>{firstLine(message)}</Free>,
      free: true,
    });
  }

  const name = [
    meta.label,
    branch,
    relative && `${relative} ago`,
    badge && badgeDescription(badge),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={cn(
        'relative flex h-full overflow-hidden rounded-md font-medium',
        pad,
        queued
          ? 'border border-dashed border-slate-500 text-status-queued-text'
          : 'text-white',
      )}
      style={{ backgroundColor: colors[status] }}
    >
      <ExternalLink
        unstyled
        href={derivation.linkUrl}
        aria-label={name}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        onPointerDown={(e) => {
          touched.current = e.pointerType === 'touch';
        }}
        onClick={(e) => {
          // A tap opens the detail sheet; mouse and keyboard follow the link.
          if (touched.current && onOpenSheet) {
            e.preventDefault();
            onOpenSheet();
          }
        }}
        {...inspect}
      />
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
                  status === 'started' && 'animate-pulse',
                )}
              >
                {meta.icon}
              </span>
              {rung >= 1 && (
                <span aria-hidden className="font-semibold">
                  {meta.label}
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
