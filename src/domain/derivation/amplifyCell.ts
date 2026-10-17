/**
 * Amplify cell derivation (spec.md §4.3.4): across all of a row's sources,
 * the newest job (by start time) among branches matching the stage's
 * pattern, reusing the existing `newestJob` port. Phase is always `deploy`
 * (Amplify's single-step status). Pure; no network.
 *
 * @module
 */
import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';
import { newestJob } from '@/lib/amplify/newestJob';

import type {
  CredentialStatus,
  EmptyCellResult,
  ProviderFailure,
} from './emptyStates';
import { resolveEmptyState } from './emptyStates';
import type { CellStatus } from './githubStatus';
import type { AmplifyJobWithBranch } from './types';

/** Amplify job status values (AWS SDK `JobStatus`): `PENDING`,
 * `PROVISIONING`, `RUNNING`, `SUCCEED`, `FAILED`, `CANCELLED`, plus
 * `CANCELLING` and `CREATED`, which spec.md §4.3.4 does not map to a cell
 * status and so fall to `mapAmplifyStatus`'s `queued` default. */
export type AmplifyJobStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'RUNNING'
  | 'SUCCEED'
  | 'FAILED'
  | 'CANCELLED'
  | 'CANCELLING'
  | 'CREATED';

/** Map an Amplify job status to the shared cell status vocabulary. An
 * absent status (the SDK types `JobSummary.status` as optional) maps to
 * `queued`, same as the unmapped `CANCELLING`/`CREATED` values. */
export function mapAmplifyStatus(
  status: AmplifyJobStatus | undefined,
): CellStatus {
  switch (status) {
    case 'PENDING':
    case 'PROVISIONING':
      return 'queued';
    case 'RUNNING':
      return 'started';
    case 'SUCCEED':
      return 'success';
    case 'FAILED':
      return 'failure';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'queued';
  }
}

export interface AmplifyCellResult {
  kind: 'ok';
  status: CellStatus;
  phase: 'deploy';
  branch: string;
  commit: string | undefined;
  /** The job's commit message, if known (C-13 rung 5). */
  message?: string;
  time: string | undefined;
  /** The winning job's source app and id, and its console link (C-13a). */
  region: string;
  appId: string;
  jobId: string | undefined;
  linkUrl: string | undefined;
}

export type AmplifyCellDerivation = AmplifyCellResult | EmptyCellResult;

/** Derive one Amplify row/stage cell from jobs already collected across all
 * of the row's sources and matching branches. */
export function deriveAmplifyCell(input: {
  jobsByBranch: readonly AmplifyJobWithBranch[];
  branchExists: boolean;
  credentialStatus: CredentialStatus;
  providerFailure?: ProviderFailure;
}): AmplifyCellDerivation {
  const best = newestJob(input.jobsByBranch.map((entry) => entry.job));
  const bestEntry = input.jobsByBranch.find((entry) => entry.job === best);

  const emptyState = resolveEmptyState({
    credentialStatus: input.credentialStatus,
    providerFailure: input.providerFailure,
    branchExists: input.branchExists,
    branch: bestEntry?.branch,
    hasRelevantRun: bestEntry !== undefined,
  });
  if (emptyState) return emptyState;
  if (!bestEntry) return { kind: 'empty', state: 'no-recent-runs' };

  const { source, branch, job } = bestEntry;
  return {
    kind: 'ok',
    status: mapAmplifyStatus(job.status),
    phase: 'deploy',
    branch,
    commit: job.commitId,
    message: job.commitMessage,
    time: job.endTime?.toISOString() ?? job.startTime?.toISOString(),
    region: source.region,
    appId: source.appId,
    jobId: job.jobId,
    linkUrl:
      job.jobId === undefined
        ? undefined
        : buildAmplifyConsoleLink({ ...source, branch, jobId: job.jobId }),
  };
}
