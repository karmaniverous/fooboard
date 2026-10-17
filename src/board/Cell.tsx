/**
 * One board cell (spec.md §3, §4.3.5, C-13, C-13a): a solid block of its
 * status colour showing the board's detail rung in the board's format, or
 * an empty state. Every cell on the board gets the same rung and format.
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
  relativeTime,
  shortSha,
  STATUS_META,
} from './cellView';
import { type CellFormat, ITEM_GAP_EM, type Rung } from './layout';
import { firstLine } from './layoutContents';

export interface CellProps {
  cell: BoardCell | undefined;
  rung: Rung;
  format: CellFormat;
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

/** Arrange the lead and the rest per the board's format (C-13): one line;
 * lead then the rest on a second line; or one item per line. */
function Arranged({
  format,
  lead,
  rest,
}: {
  format: CellFormat;
  lead: React.ReactNode;
  rest: React.ReactNode[];
}): React.JSX.Element {
  const line = 'flex min-w-0 items-center whitespace-nowrap';
  if (format === 'line' || rest.length === 0) {
    return (
      <span className={line} style={gapStyle}>
        {lead}
        {rest}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col justify-center">
      <span className={line} style={gapStyle}>
        {lead}
      </span>
      {format === 'wrapped' ? (
        <span className={line} style={gapStyle}>
          {rest}
        </span>
      ) : (
        rest.map((item, i) => (
          // Items are positional and never reorder.
          <span key={i} className={line}>
            {item}
          </span>
        ))
      )}
    </span>
  );
}

/** Free text: cut off with an ellipsis at the column width. */
const Free = ({ children }: { children: string }) => (
  <span className="min-w-0 truncate" title={children}>
    {children}
  </span>
);

export function Cell({
  cell,
  rung,
  format,
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
        title={derivation.reason}
        onClick={onOpenSheet}
        {...inspect}
      >
        <Arranged
          format={format}
          lead={<span>{label}</span>}
          rest={rung >= 4 && extra ? [<Free key="x">{extra}</Free>] : []}
        />
      </button>
    );
  }

  const { status } = derivation;
  const meta = STATUS_META[status];
  const queued = status === 'queued';
  const { time, commit, branch, message } = derivation;
  const relative = time ? relativeTime(time, now) : undefined;

  const rest: React.ReactNode[] = [];
  if (rung >= 2 && time) {
    rest.push(
      <time key="t" dateTime={time}>
        {relative}
      </time>,
    );
  }
  if (rung >= 3) {
    if (commit) {
      rest.push(
        <span key="c" className="font-mono text-[0.95em] opacity-90">
          {shortSha(commit)}
        </span>,
      );
    }
    rest.push(
      <span
        key="p"
        className="rounded border border-current px-1 text-[0.85em]"
      >
        {derivation.phase}
      </span>,
    );
  }
  if (rung >= 4 && branch) rest.push(<Free key="b">{branch}</Free>);
  if (rung >= 5 && message)
    rest.push(<Free key="m">{firstLine(message)}</Free>);

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
        className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
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
      <span className="pointer-events-none relative flex min-w-0 items-center">
        <Arranged
          format={format}
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
              <span aria-hidden className="font-semibold">
                {meta.label}
              </span>
              {badge && (
                <ExternalLink
                  unstyled
                  href={compare?.htmlUrl}
                  title={badgeDescription(badge)}
                  aria-label={badgeDescription(badge)}
                  className={cn(
                    'pointer-events-auto flex-none rounded-full px-1.5 text-[0.8em] font-bold leading-[1.6] no-underline ring-2 ring-white',
                    badge.kind === 'behind'
                      ? 'bg-badge-behind text-badge-behind-text'
                      : 'bg-badge-diverged text-badge-diverged-text',
                  )}
                >
                  {badgeText(badge)}
                </ExternalLink>
              )}
            </>
          }
          rest={rest.map((item, i) => (
            <span key={i} aria-hidden className="flex min-w-0">
              {item}
            </span>
          ))}
        />
      </span>
    </div>
  );
}
