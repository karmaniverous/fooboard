/**
 * Cell detail (spec.md C-13): what the hover tooltip and the touch detail
 * sheet both show: status, phase, branch, commit, exact time, the
 * behind/diverged commit subjects in both directions, and the links.
 *
 * @module
 */
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
          <a
            href={compare.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400"
          >
            Compare on GitHub
          </a>
        </div>
      )}
      {derivation.kind === 'ok' && derivation.linkUrl && (
        <a
          href={derivation.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400"
        >
          Open job
        </a>
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
