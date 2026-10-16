/**
 * Cell detail (spec.md C-13): status, phase, branch, commit, exact time,
 * and the behind/diverged commit subjects in both directions. Shown in a
 * hover/focus tooltip (informational: the cell and its badge are the
 * links, C-13a) and in a touch detail sheet, which also carries the links.
 *
 * @module
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, useState } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import type { BoardCell } from '@/engine';

import {
  badgeDescription,
  EMPTY_LABEL,
  shortSha,
  STATUS_META,
} from './cellView';
import { type Placement, placeTooltip } from './placement';

export function CellDetail({
  cell,
  rowName,
  stageName,
  interactive,
}: {
  cell: BoardCell;
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
          {derivation.branch && ` (${derivation.branch})`}
          {derivation.reason && (
            <div className="text-muted-foreground">{derivation.reason}</div>
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            {STATUS_META[derivation.status].label} ({derivation.phase})
          </dd>
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="truncate">{derivation.branch}</dd>
          {derivation.commit && (
            <>
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="font-mono">{shortSha(derivation.commit)}</dd>
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

/** Hover/focus tooltip, measured and placed to stay inside the viewport. */
export function CellTooltip({
  rect,
  children,
}: {
  rect: DOMRect;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPlace(
      placeTooltip(
        rect,
        { width: el.offsetWidth, height: el.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [rect]);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 w-80 max-w-[calc(100vw-12px)] overflow-hidden rounded-lg bg-slate-900 p-3 text-slate-100 shadow-xl"
      style={place ?? { left: rect.left, top: rect.bottom, opacity: 0 }}
    >
      {children}
    </div>
  );
}

/** Bottom sheet opened from a cell: a modal dialog that takes focus,
 * traps Tab, closes on Escape, the backdrop or Close, and returns focus. */
export function CellSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  // Focus goes back to the cell that opened the sheet.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-auto rounded-t-xl bg-slate-900 p-4 text-slate-100"
        >
          <Dialog.Title className="sr-only">Cell detail</Dialog.Title>
          {children}
          <Dialog.Close className="mt-3 text-sm text-sky-400">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
