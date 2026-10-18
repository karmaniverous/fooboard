/**
 * *Add test* from an unmapped run (spec.md C-15): where in the editors
 * the fix belongs, pre-filled from the run. A run no row key matches gets
 * a row key test on its workflow name; a run on a branch no stage matches
 * gets a new stage for that branch, or (`overrideDraftFor`) a
 * branch-pattern override on that repo's row or its group (C-14c); a run
 * whose jobs match no phase opens the mapping rules. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { MatchTest } from '@/domain/config/matchTest';
import type { UnmappedRun } from '@/engine';

export type EditorDraft =
  | { tab: 'Rows'; rowId: string; test: MatchTest }
  | { tab: 'Rows'; rowId: string; overrideBranch: string }
  | { tab: 'Stages'; pattern: string }
  | { tab: 'Mapping' };

/** The GitHub row reading the run's repo: unmapped runs are GitHub runs,
 * so only a GitHub row's key tests or overrides can place one. */
const githubRowFor = (run: UnmappedRun, dashboard: Pick<Dashboard, 'rows'>) =>
  dashboard.rows.find((r) => r.type === 'github' && r.repo === run.repo);

export function draftFor(
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
): EditorDraft | undefined {
  switch (run.reason.kind) {
    case 'no-stage-matches-branch':
      return { tab: 'Stages', pattern: run.reason.branch };
    case 'no-phase-matches-job':
      return { tab: 'Mapping' };
    case 'no-row-key-matches': {
      const row = githubRowFor(run, dashboard);
      return row
        ? {
            tab: 'Rows',
            rowId: row.id,
            test: {
              field: 'workflowName',
              operator: 'is',
              value: run.workflowName,
            },
          }
        : undefined;
    }
  }
}

/** The second fix for a branch no stage matches: an override on the
 * GitHub row that reads the run's repo (or its group). Undefined for other
 * reasons or when no GitHub row reads the repo. */
export function overrideDraftFor(
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
): EditorDraft | undefined {
  if (run.reason.kind !== 'no-stage-matches-branch') return undefined;
  const row = githubRowFor(run, dashboard);
  return row
    ? { tab: 'Rows', rowId: row.id, overrideBranch: run.reason.branch }
    : undefined;
}
