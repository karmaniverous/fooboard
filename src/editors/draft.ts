/**
 * *Add test* from an unmapped run (spec.md C-15): where in the editors
 * the fix belongs, pre-filled from the run. A run no row key matches gets
 * a row key test on its workflow name; a run on a branch no stage matches
 * gets a new stage for that branch, or (`overrideDraftFor`) a
 * branch-pattern override on that repo's row or its group (C-14c); a run
 * with no counted item opens the status sets. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import type { UnmappedRun } from '@/engine';

export type EditorDraft =
  | { tab: 'Rows'; rowId: string }
  | { tab: 'Rows'; rowId: string; overrideBranch: string }
  | { tab: 'Stages'; pattern?: string }
  | { tab: 'Sources' }
  | { tab: 'General' }
  | { tab: 'Statuses' };

/** The GitHub row reading the run's repo: unmapped runs are GitHub runs,
 * so only a GitHub row's key tests or overrides can place one. */
const githubRowFor = (run: UnmappedRun, dashboard: Pick<Dashboard, 'rows'>) =>
  dashboard.rows.find((r) => r.type === 'github' && r.repo === run.repo);

export function draftFor(
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
): EditorDraft | undefined {
  switch (run.reason.kind) {
    case 'no-stage-matches':
      return run.reason.branch === undefined
        ? undefined
        : { tab: 'Stages', pattern: run.reason.branch };
    case 'no-item-counts':
      return { tab: 'Statuses' };
    case 'no-row-matches': {
      const fallback = githubRowFor(run, dashboard)?.id;
      const named = run.rows.find(
        (r) => r.reason.kind === 'no-row-matches',
      )?.rowId;
      const rowId =
        named !== undefined && dashboard.rows.some((r) => r.id === named)
          ? named
          : fallback;
      return rowId ? { tab: 'Rows', rowId } : undefined;
    }
    case 'no-order-key':
      return undefined;
  }
}

/** The second fix for a branch no stage matches: an override on the
 * GitHub row that reads the run's repo (or its group). Undefined for other
 * reasons or when no GitHub row reads the repo. */
export function overrideDraftFor(
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
): EditorDraft | undefined {
  if (run.reason.kind !== 'no-stage-matches' || run.reason.branch === undefined)
    return undefined;
  const row = githubRowFor(run, dashboard);
  return row
    ? { tab: 'Rows', rowId: row.id, overrideBranch: run.reason.branch }
    : undefined;
}

/** The editor tab where `problem` is fixed. */
export function problemDraft(problem: Problem): EditorDraft {
  const { level, message } = problem;
  if (
    /source rule/.test(message) ||
    / gives no /.test(message) ||
    /read .* the most/.test(message)
  )
    return { tab: 'Sources' };
  switch (level.kind) {
    case 'row':
    case 'cell':
      return {
        tab: 'Rows',
        rowId: level.kind === 'row' ? level.id : level.rowId,
      };
    case 'stage':
    case 'columnGroup':
      return { tab: 'Stages' };
    case 'statusSet':
      return { tab: 'Statuses' };
    case 'rowGroup':
      return { tab: 'Rows', rowId: '' };
    case 'dashboard':
      return /status|item rule/.test(message)
        ? { tab: 'Statuses' }
        : { tab: 'General' };
  }
}
