/**
 * Amplify cell derivation (spec.md §4.3.4): across all of a row's sources,
 * the newest job (by start time) among branches matching the stage's
 * pattern, reusing the existing `newestJob` port. Phase is always `deploy`
 * (Amplify's single-step status). Pure; no network.
 *
 * @module
 */
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
  time: string | undefined;
  linkUrl: undefined;
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

  return {
    kind: 'ok',
    status: mapAmplifyStatus(bestEntry.job.status),
    phase: 'deploy',
    branch: bestEntry.branch,
    commit: bestEntry.job.commitId,
    time:
      bestEntry.job.endTime?.toISOString() ??
      bestEntry.job.startTime?.toISOString(),
    linkUrl: undefined,
  };
}
