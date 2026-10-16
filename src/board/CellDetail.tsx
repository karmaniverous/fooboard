/**
 * Cell detail (spec.md C-13): the hover tooltip and the touch detail sheet,
 * and what both show: status, phase, branch, commit, exact time, the
 * behind/diverged commit subjects in both directions, and the links.
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import type { BoardCell } from '@/engine';

import {
  badgeDescription,
  EMPTY_LABEL,
  shortSha,
  STATUS_META,
} from './cellView';

export function CellDetail({
  cell,
  rowName,
  stageName,
}: {
  cell: BoardCell;
  rowName: string;
  stageName: string;
}): React.JSX.Element {
  const { derivation, badge, compare } = cell;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-semibold">
        {rowName} · {stageName}
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
          <ExternalLink
            unstyled
            href={compare.htmlUrl}
            className="text-sky-400"
          >
            Compare on GitHub
          </ExternalLink>
        </div>
      )}
      {derivation.kind === 'ok' && derivation.linkUrl && (
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

/** Hover/focus tooltip placed under the cell. */
export function CellTooltip({
  rect,
  children,
}: {
  rect: DOMRect;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-80 rounded-lg bg-slate-900 p-3 text-slate-100 shadow-xl"
      style={{
        left: Math.min(rect.left, window.innerWidth - 330),
        top: rect.bottom + 6,
      }}
    >
      {children}
    </div>
  );
}

/** Bottom sheet opened by a touch tap; closes on the backdrop or Close. */
export function CellSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Cell detail"
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-xl bg-slate-900 p-4 text-slate-100"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {children}
        <button
          type="button"
          className="mt-3 text-sm text-sky-400"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
