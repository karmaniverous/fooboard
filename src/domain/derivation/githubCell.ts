/**
 * The combinator that derives one GitHub cell (spec.md A§4.3.2-A§4.3.6):
 * the newest candidate run with jobs the cell's status set cares about
 * shows its status (first matching cell status, or Unknown), and an empty
 * state stands in when there is no credential, a provider error, no
 * matching branch, or no such run. Pure; no network.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import type { MatchTest } from '@/domain/config/matchTest';
import type { StatusSet } from '@/domain/config/statusSets';
import { timeAndLink } from '@/domain/model/cell';
import type { RecordDoc } from '@/domain/model/translate';
import { githubRecord } from '@/domain/statuses/documents';
import { type ResolvedStatus, statusOf } from '@/domain/statuses/resolved';

import { selectCandidateRuns } from './candidateRuns';
import type {
  CredentialStatus,
  EmptyCellResult,
  ProviderFailure,
} from './emptyStates';
import { resolveEmptyState } from './emptyStates';
import type { GithubRunWithJobs } from './types';

/** A successfully derived GitHub cell. */
export interface GithubCellResult {
  kind: 'ok';
  status: ResolvedStatus;
  /** The cell's run's branch (spec.md A§4.3.5 staleness input). */
  branch: string;
  commit: string;
  /** The run's commit message, if known (C-13 rung 5). */
  message?: string;
  /** When the cell's job last did something (see `timeAndLink`). */
  time: string | undefined;
  /** Where the cell links (spec.md C-13a). */
  linkUrl: string;
  /** The run's document, for the detail and *Add status* (A§4.3.6). */
  /** The record its status rules saw (counted items only). */
  document: RecordDoc;
}

export type GithubCellDerivation = GithubCellResult | EmptyCellResult;

export function deriveGithubCell(input: {
  runs: readonly GithubRunWithJobs[];
  mapping: MappingSettings;
  set: StatusSet;
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

  let matched: { entry: GithubRunWithJobs; doc: RecordDoc } | undefined;
  for (const entry of candidates) {
    const doc = githubRecord(entry, input.rowKeyTests, input.set.items);
    if (doc) {
      matched = { entry, doc };
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
  if (!matched) return { kind: 'empty', state: 'no-recent-runs' };

  const { entry, doc } = matched;
  const { time, link } = timeAndLink(doc);
  return {
    kind: 'ok',
    status: statusOf(doc, input.set),
    branch: entry.run.headBranch ?? '',
    commit: entry.run.headSha,
    message: entry.run.headCommitMessage,
    time: typeof time === 'string' && time !== '' ? time : undefined,
    linkUrl: typeof link === 'string' ? link : entry.run.htmlUrl,
    document: doc,
  };
}
