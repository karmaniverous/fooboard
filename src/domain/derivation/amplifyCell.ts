/**
 * Amplify cell derivation (spec.md A§4.3.4, A§4.3.6): across all of a row's
 * sources, the newest job (by start time) among branches matching the
 * stage's pattern, reusing the `newestJob` port; its status is the first
 * cell status of the cell's set its document matches, or Unknown. Pure; no
 * network.
 *
 * @module
 */
import type { StatusSet } from '@/domain/config/statusSets';
import {
  type AmplifyJobDocument,
  amplifyJobDocument,
} from '@/domain/statuses/documents';
import { type ResolvedStatus, statusOf } from '@/domain/statuses/resolved';
import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';
import { newestJob } from '@/lib/amplify/newestJob';

import type {
  CredentialStatus,
  EmptyCellResult,
  ProviderFailure,
} from './emptyStates';
import { resolveEmptyState } from './emptyStates';
import type { AmplifyJobWithBranch } from './types';

export interface AmplifyCellResult {
  kind: 'ok';
  status: ResolvedStatus;
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
  /** The job's document, for the detail and *Add status* (A§4.3.6). */
  document: AmplifyJobDocument;
}

export type AmplifyCellDerivation = AmplifyCellResult | EmptyCellResult;

/** Derive one Amplify row/stage cell from jobs already collected across all
 * of the row's sources and matching branches. */
export function deriveAmplifyCell(input: {
  jobsByBranch: readonly AmplifyJobWithBranch[];
  set: StatusSet;
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
  const document = amplifyJobDocument(bestEntry);
  return {
    kind: 'ok',
    status: statusOf(document, input.set),
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
    document,
  };
}
