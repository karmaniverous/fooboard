/**
 * Cell detail (spec.md C-13): status, phase, branch, commit, commit
 * message, exact time, and the behind/diverged commit subjects in both
 * directions. Shown in a hover/focus tooltip (informational: the cell and
 * its badge are the links, C-13a; the short SHA and the message's first
 * line) and in a touch detail sheet, which also carries the links, the
 * full SHA with *Copy*, and every line of the message (Decision 21).
 * Problems on the cell (a window hint on an empty cell, a status-set
 * problem, spec.md A§4.3.7) are listed under it.
 *
 * @module
 */
import { useState } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { EMPTY_STATES } from '@/domain/derivation';
import type { Problem } from '@/domain/problems/problem';
import type { BoardCell } from '@/engine';
import { readmeSection } from '@/lib/site';

import { badgeDescription, EMPTY_LABEL, firstLine, shortSha } from './cellView';
import { CommitSha } from './CommitSha';

export function CellDetail({
  cell,
  rowName,
  stageName,
  interactive,
  problems = [],
}: {
  cell: BoardCell;
  /** Problems marked on this cell. */
  problems?: readonly Problem[];
  rowName: string;
  stageName: string;
  /** Include links (the sheet); the hover tooltip can't be clicked. */
  interactive: boolean;
}): React.JSX.Element {
  const { derivation, badge, compare } = cell;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-semibold">
        {rowName} &middot; {stageName}
      </div>
      {derivation.kind === 'empty' ? (
        <div>
          {EMPTY_LABEL[derivation.state]}
          {derivation.reason && (
            <div className="text-muted-foreground">{derivation.reason}</div>
          )}
          {interactive && derivation.state === EMPTY_STATES.needsCredential && (
            <ExternalLink
              unstyled
              href={readmeSection('credentials')}
              className="block text-sky-400"
            >
              How to set up a credential
            </ExternalLink>
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="text-muted-foreground">Status</dt>
          <dd>{derivation.status.name}</dd>
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="truncate">{derivation.branch}</dd>
          {derivation.commit && (
            <>
              <dt className="text-muted-foreground">Commit</dt>
              <dd className={interactive ? undefined : 'font-mono'}>
                {interactive ? (
                  <CommitSha sha={derivation.commit} />
                ) : (
                  shortSha(derivation.commit)
                )}
              </dd>
            </>
          )}
          {derivation.message && (
            <>
              <dt className="text-muted-foreground">Message</dt>
              <dd
                className={
                  interactive ? 'whitespace-pre-wrap break-words' : 'truncate'
                }
              >
                {interactive
                  ? derivation.message
                  : firstLine(derivation.message)}
              </dd>
            </>
          )}
          {derivation.time && (
            <>
              <dt className="text-muted-foreground">Time</dt>
              <dd>{new Date(derivation.time).toLocaleString()}</dd>
            </>
          )}
        </dl>
      )}
      {badge && compare && (
        <div className="mt-1">
          <div className="font-semibold text-badge-behind">
            {badgeDescription(badge)} ({compare.sourceBranch})
          </div>
          <SubjectList
            title="Missing from this branch"
            subjects={compare.behindSubjects}
          />
          <SubjectList
            title="Only on this branch"
            subjects={compare.aheadSubjects}
          />
          {interactive && (
            <ExternalLink
              unstyled
              href={compare.htmlUrl}
              className="text-sky-400"
            >
              Compare on GitHub
            </ExternalLink>
          )}
        </div>
      )}
      {interactive && derivation.kind === 'ok' && derivation.linkUrl && (
        <ExternalLink
          unstyled
          href={derivation.linkUrl}
          className="text-sky-400"
        >
          Open job
        </ExternalLink>
      )}
      {problems.length > 0 && (
        <ul className="mt-1 text-amber-600 dark:text-amber-400">
          {problems.map((p) => (
            <li key={p.id}>! {p.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubjectList({
  title,
  subjects,
}: {
  title: string;
  subjects: readonly string[];
}): React.JSX.Element | null {
  if (subjects.length === 0) return null;
  return (
    <div className="mt-1">
      <div className="text-muted-foreground">{title}</div>
      <ul className="list-disc pl-4">
        {subjects.map((s, i) => (
          <li key={`${String(i)}-${s}`} className="truncate">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hover/focus tooltip: the library's Popover anchored to the cell, placed
 * below it when it fits, else above, always inside the window. Not modal
 * and never focused (the cell keeps focus); it has the tooltip role. */
export function CellTooltip({
  rect,
  children,
}: {
  rect: DOMRect;
  children: React.ReactNode;
}): React.JSX.Element {
  const anchor = { current: { getBoundingClientRect: () => rect } };
  return (
    <Popover open>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        role="tooltip"
        side="bottom"
        align="start"
        avoidCollisions
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
        className="pointer-events-none max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-12px)] overflow-hidden rounded-lg border-0 bg-slate-900 p-3 text-slate-100 shadow-xl"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** Bottom sheet opened from a cell: the library's Sheet, modal (takes
 * focus, traps Tab, closes on Escape, the backdrop or Close) and returning
 * focus to the cell that opened it. */
export function CellSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        closeButton={false}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          opener?.focus();
        }}
        className="gap-0 border-0 bg-slate-900 p-4 text-slate-100"
      >
        <SheetTitle className="sr-only">Cell detail</SheetTitle>
        {children}
        <SheetClose className="mt-3 self-start text-sm text-sky-400">
          Close
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
