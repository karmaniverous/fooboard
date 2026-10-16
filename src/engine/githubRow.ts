/**
 * Refresh one GitHub row (spec.md §4.3.2-4.3.5): one runs request and one
 * branches request per repo, then, per stage, jobs for the newest candidate
 * runs until one has relevant jobs (jobs are fetched at most once per run).
 * Provider errors become cell states: a missing or rejected token shows
 * *needs credential*, rate limiting keeps the previous cells, anything else
 * shows *error*.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import type { GithubRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import {
  classifyUnmappedRun,
  type CredentialStatus,
  deriveGithubCell,
  type GithubCellDerivation,
  type GithubRunWithJobs,
  isCandidateRun,
  type ProviderFailure,
} from '@/domain/derivation';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';
import { describeError } from '@/lib/errors';
import {
  GitHubAuthError,
  type GitHubReader,
  mapRunWithJobs,
  mapWorkflowRun,
  RateLimitedError,
  type WorkflowRun,
} from '@/lib/github';

import type { UnmappedRun } from './types';

/** At most this many candidate runs per cell have their jobs fetched. */
const MAX_RUNS_PER_CELL = 5;

/** A branch in the repo, dated by its newest run (REST branches carry no
 * date; branches without runs date to the epoch). */
export interface DatedBranch {
  name: string;
  updatedAt: string;
}

/** A refreshed row: per-stage derivations, unmapped runs, and the repo's
 * branches for staleness. */
export interface GithubRowRefresh {
  kind: 'refreshed';
  cells: Record<string, GithubCellDerivation>;
  unmapped: UnmappedRun[];
  branches: DatedBranch[];
}

/** Rate limited: keep showing the previous cells (spec.md §4.3.5). */
export interface GithubRowRateLimited {
  kind: 'rate-limited';
}

/** `owner/name` → the reader's repo reference. */
export const repoRef = (repo: string): { owner: string; repo: string } => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, repo: name };
};

/** Every stage shows the same empty state (missing token, error). */
function emptyRow(
  row: GithubRow,
  stages: readonly Stage[],
  mapping: MappingSettings,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): GithubRowRefresh {
  const cells = Object.fromEntries(
    stages.map((s) => [
      s.id,
      deriveGithubCell({
        runs: [],
        mapping,
        branchPattern: s.branchPattern,
        rowKeyTests: row.rowKeyTests,
        branchExists: false,
        credentialStatus,
        providerFailure,
      }),
    ]),
  );
  return { kind: 'refreshed', cells, unmapped: [], branches: [] };
}

/** Refresh one GitHub row; `reader` is `undefined` if the token is missing. */
export async function refreshGithubRow(
  row: GithubRow,
  stages: readonly Stage[],
  mapping: MappingSettings,
  reader: GitHubReader | undefined,
): Promise<GithubRowRefresh | GithubRowRateLimited> {
  if (!reader) return emptyRow(row, stages, mapping, 'missing');
  try {
    return await refreshWith(row, stages, mapping, reader);
  } catch (err) {
    if (err instanceof RateLimitedError) return { kind: 'rate-limited' };
    if (err instanceof GitHubAuthError) {
      return emptyRow(row, stages, mapping, 'expired');
    }
    return emptyRow(row, stages, mapping, 'ok', {
      message: describeError(err),
      isRateLimit: false,
    });
  }
}

async function refreshWith(
  row: GithubRow,
  stages: readonly Stage[],
  mapping: MappingSettings,
  reader: GitHubReader,
): Promise<GithubRowRefresh> {
  const ref = repoRef(row.repo);
  const raw = await reader.listWorkflowRuns(ref, {
    perPage: 100,
    excludePullRequests: true,
  });
  const runs: GithubRunWithJobs[] = raw.map((r) => ({
    run: mapWorkflowRun(r),
    jobs: [],
  }));
  const branchNames = (await reader.listBranches(ref)).map((b) => b.name);

  const fetched = new Map<number, GithubRunWithJobs>();
  const withJobs = async (run: WorkflowRun): Promise<GithubRunWithJobs> => {
    const cached = fetched.get(run.id);
    if (cached) return cached;
    const jobs = await reader.listRunJobs(ref, run.id, { filter: 'latest' });
    const entry = mapRunWithJobs(run, jobs);
    fetched.set(run.id, entry);
    return entry;
  };

  const cells: Record<string, GithubCellDerivation> = {};
  for (const stage of stages) {
    const input = {
      mapping,
      branchPattern: stage.branchPattern,
      rowKeyTests: row.rowKeyTests,
      branchExists: branchNames.some((b) =>
        matchesBranchPattern(stage.branchPattern, b),
      ),
      credentialStatus: 'ok' as const,
    };
    const candidates = raw
      .filter((_, i) => isCandidateRun(runs[i], mapping, stage.branchPattern))
      .slice(0, MAX_RUNS_PER_CELL);
    const seen: GithubRunWithJobs[] = [];
    let derived = deriveGithubCell({ ...input, runs: seen });
    for (const run of candidates) {
      seen.push(await withJobs(run));
      derived = deriveGithubCell({ ...input, runs: seen });
      if (derived.kind === 'ok') break;
    }
    cells[stage.id] = derived;
  }

  return {
    kind: 'refreshed',
    cells,
    unmapped: unmappedRuns(row, stages, mapping, runs, fetched),
    branches: datedBranches(branchNames, runs),
  };
}

/** Runs the board couldn't place. Branch reasons need no jobs; job-based
 * reasons are reported only for runs whose jobs were fetched (older
 * candidates are superseded, not unmapped). */
function unmappedRuns(
  row: GithubRow,
  stages: readonly Stage[],
  mapping: MappingSettings,
  runs: readonly GithubRunWithJobs[],
  fetched: ReadonlyMap<number, GithubRunWithJobs>,
): UnmappedRun[] {
  return runs.flatMap((entry) => {
    const full = fetched.get(entry.run.id);
    const reason = classifyUnmappedRun(full ?? entry, stages, [row], mapping);
    if (!reason) return [];
    if (reason.kind !== 'no-stage-matches-branch' && !full) return [];
    return [
      {
        rowId: row.id,
        runId: entry.run.id,
        workflowName: entry.run.workflowName,
        branch: entry.run.headBranch,
        htmlUrl: entry.run.htmlUrl,
        reason,
      },
    ];
  });
}

/** Date each branch by its newest run (runs arrive newest first). */
function datedBranches(
  names: readonly string[],
  runs: readonly GithubRunWithJobs[],
): DatedBranch[] {
  const newest = new Map<string, string>();
  for (const { run } of runs) {
    if (run.headBranch && !newest.has(run.headBranch)) {
      newest.set(run.headBranch, run.createdAt);
    }
  }
  return names.map((name) => ({
    name,
    updatedAt: newest.get(name) ?? new Date(0).toISOString(),
  }));
}
