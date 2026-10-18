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
import { githubRunDocument } from '@/domain/statuses/documents';

import { isCandidateRun, isExcludedEvent } from './candidateRuns';
import type { GithubRunWithJobs } from './types';

export type UnmappedReason =
  | { kind: 'no-stage-matches-branch'; branch: string }
  | { kind: 'no-relevant-job' }
  | { kind: 'no-row-key-matches' };

/** Human-readable text for the Unmapped runs panel (spec.md C-15). */
export function describeUnmappedReason(reason: UnmappedReason): string {
  switch (reason.kind) {
    case 'no-stage-matches-branch':
      return `no stage matches branch "${reason.branch}"`;
    case 'no-relevant-job':
      return 'no job its status set covers';
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
  /** The job test of the status set those cells use (A§4.3.6). */
  jobTest: Record<string, unknown>;
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
  // Placed when a row whose patterns take the branch sees a job its status
  // set covers (A§4.3.6).
  const sees = (row: RowKeyInput, keys: readonly MatchTest[]) =>
    githubRunDocument(entry, keys, row.jobTest) !== undefined;
  if (!branchRows.some((row) => sees(row, [])))
    return { kind: 'no-relevant-job' };
  if (branchRows.some((row) => sees(row, row.rowKeyTests))) return undefined;
  return { kind: 'no-row-key-matches' };
}
