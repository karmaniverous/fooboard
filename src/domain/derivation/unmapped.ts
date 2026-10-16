/**
 * Unmapped-run reasons (spec.md C-15): why a recent run on a dashboard's
 * repos was not placed in any cell. `pull_request`/`pull_request_target`
 * runs are always excluded (spec.md §4.3.1) and are never "unmapped"; a run
 * that fails the workflow filter is bucketed with "no stage matches
 * branch", since from the mapping engine's view it never becomes a
 * candidate for any stage either way. Pure; no network.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import type { MatchTest } from '@/domain/config/matchTest';
import type { Stage } from '@/domain/config/stage';

import { isCandidateRun, isExcludedEvent } from './candidateRuns';
import { relevantJobs } from './githubPhase';
import type { GithubRunWithJobs } from './types';

export type UnmappedReason =
  | { kind: 'no-stage-matches-branch'; branch: string }
  | { kind: 'no-phase-matches-job' }
  | { kind: 'no-row-key-matches' };

/** Human-readable text for the Unmapped runs panel (spec.md C-15). */
export function describeUnmappedReason(reason: UnmappedReason): string {
  switch (reason.kind) {
    case 'no-stage-matches-branch':
      return `no stage matches branch "${reason.branch}"`;
    case 'no-phase-matches-job':
      return 'no phase matches any job';
    case 'no-row-key-matches':
      return 'no row key matches';
  }
}

/** A row's key tests, keyed just enough to check for a match (repo
 * membership is the caller's responsibility: pass only the rows for the
 * run's repo). */
export interface RowKeyInput {
  rowKeyTests: readonly MatchTest[];
}

/**
 * Classify why `entry` (a run with its jobs) was not placed in any cell of
 * a dashboard, given the stages and rows for its repo. Returns `undefined`
 * if the run **is** mapped to at least one row/stage, meaning it should not
 * appear in the Unmapped runs panel.
 */
export function classifyUnmappedRun(
  entry: GithubRunWithJobs,
  stages: readonly Pick<Stage, 'branchPattern'>[],
  rows: readonly RowKeyInput[],
  mapping: MappingSettings,
): UnmappedReason | undefined {
  if (isExcludedEvent(entry.run.event)) return undefined;

  const matchedStages = stages.filter((stage) =>
    isCandidateRun(entry, mapping, stage.branchPattern),
  );
  if (matchedStages.length === 0) {
    return {
      kind: 'no-stage-matches-branch',
      branch: entry.run.headBranch ?? '',
    };
  }

  const keylessRows = rows.filter((row) => row.rowKeyTests.length === 0);
  const keyedRows = rows.filter((row) => row.rowKeyTests.length > 0);

  const phaseOnly = relevantJobs(
    entry.jobs,
    entry.run.workflowName,
    mapping.phases,
    [],
  );
  if (phaseOnly.length === 0) return { kind: 'no-phase-matches-job' };

  if (keylessRows.length > 0) return undefined;

  for (const row of keyedRows) {
    const keyed = relevantJobs(
      entry.jobs,
      entry.run.workflowName,
      mapping.phases,
      row.rowKeyTests,
    );
    if (keyed.length > 0) return undefined;
  }
  return { kind: 'no-row-key-matches' };
}
