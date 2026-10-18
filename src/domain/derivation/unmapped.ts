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

/** What classification needs of a row reading the run's repo (repo
 * membership is the caller's responsibility: pass only those rows). */
export interface RowKeyInput {
  rowKeyTests: readonly MatchTest[];
  /** The row's effective branch patterns, one per stage (C-14c). */
  branchPatterns: readonly string[];
}

/**
 * Classify why `entry` (a run with its jobs) was not placed in any cell,
 * given the rows reading its repo. Returns `undefined` if the run **is**
 * mapped to at least one row and stage, meaning it should not appear in
 * the Unmapped runs panel.
 */
export function classifyUnmappedRun(
  entry: GithubRunWithJobs,
  rows: readonly RowKeyInput[],
  mapping: MappingSettings,
): UnmappedReason | undefined {
  if (isExcludedEvent(entry.run.event)) return undefined;

  // Only rows whose own (effective) patterns take the branch can place it.
  const branchRows = rows.filter((row) =>
    row.branchPatterns.some((p) => isCandidateRun(entry, mapping, p)),
  );
  if (branchRows.length === 0) {
    return {
      kind: 'no-stage-matches-branch',
      branch: entry.run.headBranch ?? '',
    };
  }
  const keylessRows = branchRows.filter((row) => row.rowKeyTests.length === 0);
  const keyedRows = branchRows.filter((row) => row.rowKeyTests.length > 0);

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
