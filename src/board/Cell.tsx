/**
 * One board cell (spec.md §3, §4.3.5, C-13, C-13a): a solid block of its
 * status colour with as much detail as its size allows, or an empty state.
 * The cell is a real link to the job (or Amplify console); the
 * behind/diverged badge is a separate link to the compare page, placed
 * beside the cell link rather than inside it (links can't nest).
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
  type DetailLevel,
  EMPTY_LABEL,
  relativeTime,
  shortSha,
  STATUS_META,
} from './cellView';

export interface CellProps {
  cell: BoardCell | undefined;
  level: DetailLevel;
  rowHeight: 'compact' | 'full';
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

export function Cell({
  cell,
  level,
  rowHeight,
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

  if (!cell) {
    return <div className="h-full rounded-md bg-muted/40" aria-busy />;
  }

  const { derivation, badge, compare } = cell;
  if (derivation.kind === 'empty') {
    const label =
      derivation.state === 'no-recent-runs' && derivation.branch
        ? `${derivation.branch}: ${EMPTY_LABEL[derivation.state]}`
        : EMPTY_LABEL[derivation.state];
    // A button, so every empty state can be reached and opened (keyboard,
    // tap, click) even at the smallest size, where it shows no text.
    return (
      <button
        type="button"
        aria-label={
          derivation.reason ? `${label}: ${derivation.reason}` : label
        }
        className={cn(
          'flex h-full w-full items-center overflow-hidden rounded-md border px-2 text-left text-[0.85em] italic text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
          EMPTY_CLASS[derivation.state],
        )}
        title={derivation.reason}
        onClick={onOpenSheet}
        {...inspect}
      >
        {level >= 2 && <span className="truncate">{label}</span>}
      </button>
    );
  }

  const { status } = derivation;
  const meta = STATUS_META[status];
  const queued = status === 'queued';
  const time = derivation.time;
  const details = (
    <>
      {level >= 2 && time && (
        <time dateTime={time} title={new Date(time).toLocaleString()}>
          {relativeTime(time, now)}
        </time>
      )}
      {level >= 4 && derivation.commit && (
        <span className="font-mono text-[0.9em] opacity-90">
          {shortSha(derivation.commit)}
        </span>
      )}
      {level >= 4 && (status === 'started' || status === 'partialSuccess') && (
        <span className="rounded border border-current px-1 text-[0.8em]">
          {derivation.phase}
        </span>
      )}
    </>
  );

  return (
    <div className="relative h-full">
      <ExternalLink
        unstyled
        href={derivation.linkUrl}
        aria-label={`${meta.label}, ${derivation.branch}`}
        className={cn(
          'flex h-full overflow-hidden rounded-md px-2 font-medium no-underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          rowHeight === 'full'
            ? 'flex-col justify-center gap-0.5'
            : 'items-center gap-1.5',
          queued
            ? 'border border-dashed border-slate-500 text-status-queued-text'
            : 'text-white',
          badge && 'pr-9',
        )}
        style={{ backgroundColor: colors[status] }}
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
      >
        <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden
            className={cn(
              'w-[1em] flex-none text-center',
              status === 'started' && 'animate-pulse',
            )}
          >
            {meta.icon}
          </span>
          {level >= 3 && <span className="font-semibold">{meta.label}</span>}
          {rowHeight === 'compact' && details}
        </span>
        {rowHeight === 'full' && level >= 2 && (
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[0.9em] opacity-90">
            {details}
          </span>
        )}
      </ExternalLink>
      {badge && (
        <ExternalLink
          unstyled
          href={compare?.htmlUrl}
          title={badgeDescription(badge)}
          aria-label={badgeDescription(badge)}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-[0.8em] font-bold leading-[1.5] no-underline ring-2 ring-white',
            badge.kind === 'behind'
              ? 'bg-badge-behind text-badge-behind-text'
              : 'bg-badge-diverged text-badge-diverged-text',
          )}
        >
          {badgeText(badge)}
        </ExternalLink>
      )}
    </div>
  );
}
