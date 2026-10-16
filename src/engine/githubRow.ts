/**
 * Refresh the GitHub rows that read one repository with one token (spec.md
 * §4.3.2-4.3.5). Several rows can share a repo (keyed monorepo rows), so
 * runs and branches are read once per repo, and each run's jobs at most
 * once, however many rows and stages need them. Unmapped runs are judged
 * against every row on the repo, so a run another row shows isn't
 * reported. Provider errors become cell states: a missing or rejected
 * token shows *needs credential*, rate limiting keeps the previous cells,
 * anything else shows *error*.
 *
 * @module
 */
import { objectify } from 'radash';

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
  relevantJobs,
} from '@/domain/derivation';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';
import {
  GitHubAuthError,
  type GitHubReader,
  mapRunWithJobs,
  mapWorkflowRun,
  RateLimitedError,
  type WorkflowRun,
} from '@/lib/github';

import { failureOutcome } from './providerOutcome';
import type { UnmappedRun } from './types';

/** At most this many candidate runs per cell have their jobs fetched. */
const MAX_RUNS_PER_CELL = 5;

/** A branch in the repo, dated by its newest run (REST branches carry no
 * date; branches without runs date to the epoch). */
export interface DatedBranch {
  name: string;
  updatedAt: string;
}

/** One derived cell and whether its run is still going (jobs queued or in
 * progress), which the displayed status alone can't tell. */
interface CellView {
  derivation: GithubCellDerivation;
  active: boolean;
}

/** Refreshed rows of one repo: cells keyed by row then stage. */
export interface GithubRepoRefresh {
  kind: 'refreshed';
  rows: Record<string, Record<string, CellView>>;
  unmapped: UnmappedRun[];
  branches: DatedBranch[];
}

/** Rate limited: keep showing the previous cells (spec.md §4.3.5). */
export interface GithubRepoRateLimited {
  kind: 'rate-limited';
}

/** `owner/name` → the reader's repo reference. */
export const repoRef = (repo: string): { owner: string; repo: string } => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, repo: name };
};

/** Every cell of every row shows the same empty state. */
function emptyRows(
  rows: readonly GithubRow[],
  stages: readonly Stage[],
  mapping: MappingSettings,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): GithubRepoRefresh {
  const cellsOf = (row: GithubRow) =>
    objectify(
      stages,
      (s) => s.id,
      (s): CellView => ({
        active: false,
        derivation: deriveGithubCell({
          runs: [],
          mapping,
          branchPattern: s.branchPattern,
          rowKeyTests: row.rowKeyTests,
          branchExists: false,
          credentialStatus,
          providerFailure,
        }),
      }),
    );
  return {
    kind: 'refreshed',
    rows: objectify(rows, (r) => r.id, cellsOf),
    unmapped: [],
    branches: [],
  };
}

/** Refresh `rows` (one repo, one token). `repoRows` are all the
 * dashboard's rows on that repo, for unmapped classification. `reader` is
 * `undefined` if the token is missing. */
export async function refreshGithubRepo(
  rows: readonly GithubRow[],
  repoRows: readonly GithubRow[],
  stages: readonly Stage[],
  mapping: MappingSettings,
  reader: GitHubReader | undefined,
): Promise<GithubRepoRefresh | GithubRepoRateLimited> {
  if (!reader) return emptyRows(rows, stages, mapping, 'missing');
  try {
    return await refreshWith(rows, repoRows, stages, mapping, reader);
  } catch (err) {
    const outcome = failureOutcome(err, {
      isRateLimit: (e) => e instanceof RateLimitedError,
      isAuth: (e) => e instanceof GitHubAuthError,
    });
    return outcome.kind === 'rate-limited'
      ? outcome
      : emptyRows(
          rows,
          stages,
          mapping,
          outcome.credentialStatus,
          outcome.providerFailure,
        );
  }
}

async function refreshWith(
  rows: readonly GithubRow[],
  repoRows: readonly GithubRow[],
  stages: readonly Stage[],
  mapping: MappingSettings,
  reader: GitHubReader,
): Promise<GithubRepoRefresh> {
  const repo = rows[0]?.repo ?? '';
  const ref = repoRef(repo);
  const raw = await reader.listWorkflowRuns(ref, {
    perPage: 100,
    excludePullRequests: true,
  });
  const runs: GithubRunWithJobs[] = raw.map((r) => ({
    run: mapWorkflowRun(r),
    jobs: [],
  }));
  const branchNames = (await reader.listBranches(ref)).map((b) => b.name);

  const fetched = new Map<number, Promise<GithubRunWithJobs>>();
  const withJobs = (run: WorkflowRun): Promise<GithubRunWithJobs> => {
    let entry = fetched.get(run.id);
    if (!entry) {
      entry = reader
        .listRunJobs(ref, run.id, { filter: 'latest' })
        .then((jobs) => mapRunWithJobs(run, jobs));
      fetched.set(run.id, entry);
    }
    return entry;
  };

  const cellFor = async (row: GithubRow, stage: Stage): Promise<CellView> => {
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
    let derivation = deriveGithubCell({ ...input, runs: seen });
    for (const run of candidates) {
      seen.push(await withJobs(run));
      derivation = deriveGithubCell({ ...input, runs: seen });
      if (derivation.kind === 'ok') break;
    }
    const decided = derivation.kind === 'ok' ? seen.at(-1) : undefined;
    const active = decided
      ? relevantJobs(
          decided.jobs,
          decided.run.workflowName,
          mapping.phases,
          row.rowKeyTests,
        ).some(({ job }) => job.status !== 'completed')
      : false;
    return { derivation, active };
  };

  const result: Record<string, Record<string, CellView>> = {};
  for (const row of rows) {
    const cells: Record<string, CellView> = {};
    for (const stage of stages) cells[stage.id] = await cellFor(row, stage);
    result[row.id] = cells;
  }

  const settled = new Map<number, GithubRunWithJobs>();
  for (const [id, entry] of fetched) settled.set(id, await entry);
  return {
    kind: 'refreshed',
    rows: result,
    unmapped: unmappedRuns(repo, repoRows, stages, mapping, runs, settled),
    branches: datedBranches(branchNames, runs),
  };
}

/** Runs no row on the repo could place. Branch reasons need no jobs;
 * job-based reasons are reported only for runs whose jobs were fetched
 * (older candidates are superseded, not unmapped). */
function unmappedRuns(
  repo: string,
  repoRows: readonly GithubRow[],
  stages: readonly Stage[],
  mapping: MappingSettings,
  runs: readonly GithubRunWithJobs[],
  fetched: ReadonlyMap<number, GithubRunWithJobs>,
): UnmappedRun[] {
  return runs.flatMap((entry) => {
    const full = fetched.get(entry.run.id);
    const reason = classifyUnmappedRun(
      full ?? entry,
      stages,
      repoRows,
      mapping,
    );
    if (!reason) return [];
    if (reason.kind !== 'no-stage-matches-branch' && !full) return [];
    return [
      {
        repo,
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
