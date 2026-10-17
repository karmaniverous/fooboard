/**
 * The combinator that derives one GitHub cell (spec.md §4.3.2-§4.3.5): pick
 * the newest candidate run with relevant jobs, derive its status, and fall
 * back to an empty state when there is no credential, a provider error, no
 * matching branch, or no recent run. Pure; no network.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import type { MatchTest } from '@/domain/config/matchTest';

import { selectCandidateRuns } from './candidateRuns';
import type {
  CredentialStatus,
  EmptyCellResult,
  ProviderFailure,
} from './emptyStates';
import { resolveEmptyState } from './emptyStates';
import type { Phase } from './githubPhase';
import { relevantJobs } from './githubPhase';
import type { CellStatus } from './githubStatus';
import { deriveGithubCellStatus } from './githubStatus';
import type { GithubRunWithJobs, GithubWorkflowJob } from './types';

/** A successfully derived GitHub cell. */
export interface GithubCellResult {
  kind: 'ok';
  status: CellStatus;
  phase: Phase;
  /** The cell's run's branch (spec.md §4.3.5 staleness input). */
  branch: string;
  commit: string;
  /** The run's commit message, if known (C-13 rung 5). */
  message?: string;
  /** The determining job's completion time, or start time while queued or
   * running (spec.md §4.3.5). */
  time: string | undefined;
  /** The determining job's link, for click-through (spec.md C-13a). */
  linkUrl: string;
}

export type GithubCellDerivation = GithubCellResult | EmptyCellResult;

function determiningJobTime(job: GithubWorkflowJob): string | undefined {
  return job.completedAt ?? job.startedAt ?? undefined;
}

/** Derive one GitHub row/stage cell. */
export function deriveGithubCell(input: {
  runs: readonly GithubRunWithJobs[];
  mapping: MappingSettings;
  branchPattern: string;
  rowKeyTests: readonly MatchTest[];
  branchExists: boolean;
  credentialStatus: CredentialStatus;
  providerFailure?: ProviderFailure;
}): GithubCellDerivation {
  const candidates = selectCandidateRuns(
    input.runs,
    input.mapping,
    input.branchPattern,
  );

  let matched:
    | { entry: GithubRunWithJobs; relevant: ReturnType<typeof relevantJobs> }
    | undefined;
  for (const entry of candidates) {
    const relevant = relevantJobs(
      entry.jobs,
      entry.run.workflowName,
      input.mapping.phases,
      input.rowKeyTests,
    );
    if (relevant.length > 0) {
      matched = { entry, relevant };
      break;
    }
  }

  const emptyState = resolveEmptyState({
    credentialStatus: input.credentialStatus,
    providerFailure: input.providerFailure,
    branchExists: input.branchExists,
    branch: matched?.entry.run.headBranch ?? undefined,
    hasRelevantRun: matched !== undefined,
  });
  if (emptyState) return emptyState;
  if (!matched) {
    // branchExists but no candidate run reached this point only if
    // resolveEmptyState didn't already report no-recent-runs; defensive.
    return { kind: 'empty', state: 'no-recent-runs' };
  }

  const derived = deriveGithubCellStatus(matched.relevant);
  if (!derived) return { kind: 'empty', state: 'no-recent-runs' };

  return {
    kind: 'ok',
    status: derived.status,
    phase: derived.phase,
    branch: matched.entry.run.headBranch ?? '',
    commit: matched.entry.run.headSha,
    message: matched.entry.run.headCommitMessage,
    time: determiningJobTime(derived.determiningJob),
    linkUrl: derived.determiningJob.htmlUrl,
  };
}
