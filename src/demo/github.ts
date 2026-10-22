/**
 * Demo GitHub provider (spec.md C-23): implements the `GitHubApi` request
 * port from the demo scenarios, returning REST-shaped payloads so the real
 * query layer, mapping and derivation code run unchanged. A run is in
 * progress while any of its jobs is. Two rows fail on purpose
 * (`legacy-billing`: rejected credential; `flaky-svc`: server error), and
 * three runs are deliberately unmapped, one per reason (a `hotfix/*`
 * branch, a lint-only run, and another service's deploy in the keyed row's
 * repo).
 *
 * @module
 */
import { alphabetical } from 'radash';

import type { Fetched, GitHubApi, RepoRef } from '@/lib/github/api';
import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { Job, WorkflowRun } from '@/lib/github/schemas';

import {
  DEMO_GITHUB_REPOS,
  DEMO_KEYED_REPO,
  DEMO_STAGE_IDS,
  demoDashboard,
} from './board';
import {
  type DemoJobState,
  jobStates,
  MINUTE,
  scenarioFor,
  stageBranch,
  stageForBranch,
  stalenessCounts,
} from './scenarios';

const repoIndex = (repo: string): number =>
  (DEMO_GITHUB_REPOS as readonly string[]).indexOf(repo);

const iso = (ms: number): string => new Date(ms).toISOString();

const sha = (seed: number): string =>
  (seed * 2654435761).toString(16).padStart(8, '0').slice(-7) + 'a1b2c3d';

/** REST job status/conclusion for a demo job state. */
function restState(state: DemoJobState): Pick<Job, 'status' | 'conclusion'> {
  if (state === 'waiting') return { status: 'waiting', conclusion: null };
  if (state === 'queued') return { status: 'queued', conclusion: null };
  if (state === 'running') return { status: 'in_progress', conclusion: null };
  return { status: 'completed', conclusion: state };
}

interface DemoRun {
  run: WorkflowRun;
  jobs: (startMs: number, nowMs: number) => Job[];
}

/** All demo runs for one repo, newest first. */
function demoRuns(repo: string, startMs: number): DemoRun[] {
  const r = repoIndex(repo);
  const url = `https://github.com/acme/${repo}/actions/runs`;
  const runs: DemoRun[] = [];
  const makeRun = (
    id: number,
    branch: string,
    createdMs: number,
    name = 'Deploy',
  ): WorkflowRun => ({
    id,
    name,
    head_branch: branch,
    head_sha: sha(id),
    head_commit: {
      message: DEMO_MESSAGES[id % DEMO_MESSAGES.length] ?? 'Update',
    },
    status: 'completed',
    conclusion: 'success',
    created_at: iso(createdMs),
    updated_at: iso(createdMs),
    run_attempt: 1,
    html_url: `${url}/${String(id)}`,
    workflow_id: 1,
    event: 'push',
  });
  const job = (
    runId: number,
    n: number,
    name: string,
    state: DemoJobState,
    from: number,
  ): Job => ({
    id: runId * 10 + n,
    run_id: runId,
    name,
    ...restState(state),
    started_at: state === 'waiting' || state === 'queued' ? null : iso(from),
    completed_at:
      state === 'success' || state === 'failure' || state === 'cancelled'
        ? iso(from + 2 * MINUTE)
        : null,
    html_url: `${url}/${String(runId)}/job/${String(runId * 10 + n)}`,
    run_attempt: 1,
  });

  // The keyed row's jobs name their service (its row key test).
  const key = repo === DEMO_KEYED_REPO ? ` (${repo})` : '';

  DEMO_STAGE_IDS.forEach((stageId, s) => {
    const scenario = scenarioFor(repo, stageId);
    if (scenario === 'noBranch' || scenario === 'noRuns') return;
    const id = 1000 + r * 100 + s * 10;
    const live = scenario === 'started' || scenario === 'queued';
    const createdMs = live ? startMs - MINUTE : startMs - (s + 1) * 37 * MINUTE;
    runs.push({
      run: makeRun(id, stageBranch(stageId), createdMs),
      jobs: (start, now) => {
        const states = jobStates(scenario, now - start);
        return [
          job(id, 1, `deploy${key}`, states.deploy, createdMs),
          job(id, 2, `test${key}`, states.test, createdMs + 3 * MINUTE),
        ];
      },
    });
  });

  if (repo === 'api-core') {
    const id = 990;
    runs.push({
      run: makeRun(id, 'hotfix/login', startMs - 5 * MINUTE),
      jobs: () => [job(id, 1, 'deploy', 'success', startMs - 5 * MINUTE)],
    });
  }
  if (repo === 'web-app') {
    const id = 991;
    runs.push({
      run: makeRun(id, 'dev', startMs - 2 * MINUTE, 'Lint'),
      jobs: () => [job(id, 1, 'lint', 'success', startMs - 2 * MINUTE)],
    });
  }
  if (repo === DEMO_KEYED_REPO) {
    // Another service's deploy in the same repo: no row key matches.
    const id = 992;
    runs.push({
      run: makeRun(id, 'dev', startMs - 3 * MINUTE),
      jobs: () => [
        job(id, 1, 'deploy (refunds)', 'success', startMs - 3 * MINUTE),
      ],
    });
  }
  return alphabetical(runs, (d) => d.run.created_at, 'desc');
}

/** Branches that exist in a demo repo (stages without `noBranch`). */
function demoBranches(repo: string): string[] {
  return DEMO_STAGE_IDS.filter(
    (id) => scenarioFor(repo, id) !== 'noBranch',
  ).map((id) => stageBranch(id));
}

/** Plausible commit messages for the demo's richest detail (C-13 rung 5). */
const DEMO_MESSAGES = [
  'Fix flaky checkout test',
  'Bump dependencies',
  'Add retry to payment webhook',
  'Tune cache headers',
  'Refactor auth middleware',
  'Release notes for 24.3',
];

/** A demo answer: never a 304, never paginated. */
const fetched = <T>(data: T): Fetched<T> => ({
  notModified: false,
  data,
  etag: null,
  hasNext: false,
  redirected: false,
});

/** `run` as GitHub reports it at `jobs`' states: in progress while any
 * job is; else completed, failed if any job failed. */
function runAt(run: WorkflowRun, jobs: readonly Job[]): WorkflowRun {
  if (jobs.some((j) => j.status !== 'completed'))
    return { ...run, status: 'in_progress', conclusion: null };
  const failed = jobs.find((j) => j.conclusion !== 'success');
  return { ...run, conclusion: failed?.conclusion ?? run.conclusion };
}

/** Is `base...head` a cell compared with its source stage (the forward
 * compare), rather than the source compared with the cell? */
function isForward(base: string, head: string): boolean {
  const cell = stageForBranch(base);
  const source = demoDashboard.stages.find((s) => s.id === cell)?.sourceStageId;
  return source !== undefined && source === stageForBranch(head);
}

/** The demo's token budget at `now`: plenty left. */
const demoBudget = (now: number): RateLimitBudget => ({
  limit: 5000,
  remaining: 4870,
  reset: Math.floor(now / 1000) + 3600,
  used: 130,
  status: 'ok',
});

/** Create the demo GitHub request port; `clock` drives scenario
 * progress, and every answer reports the demo budget to `onBudget`. */
export function createDemoGitHubApi(
  clock: () => number = Date.now,
  onBudget: (budget: RateLimitBudget) => void = () => undefined,
): GitHubApi {
  const startMs = clock();
  const guard = ({ repo }: RepoRef, path: string): void => {
    if (repo === 'legacy-billing') throw new GitHubAuthError(path);
    if (repo === 'flaky-svc') throw new GitHubHttpError(path, 502);
  };
  const call = <T>(ref: RepoRef, path: string, fn: () => T): Promise<T> => {
    try {
      onBudget(demoBudget(clock()));
      guard(ref, path);
      return Promise.resolve(fn());
    } catch (err) {
      return Promise.reject(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  };
  const subjects = (n: number, branch: string) =>
    Array.from({ length: n }, (_, i) => ({
      sha: sha(i + branch.length),
      commit: { message: `${branch} change ${String(i + 1)}` },
    }));

  return {
    runsPage: (ref) =>
      call(ref, 'runs', () =>
        fetched(
          demoRuns(ref.repo, startMs).map((d) =>
            runAt(d.run, d.jobs(startMs, clock())),
          ),
        ),
      ),
    jobsPage: (ref, runId) =>
      call(ref, 'jobs', () =>
        fetched(
          demoRuns(ref.repo, startMs)
            .find((d) => d.run.id === runId)
            ?.jobs(startMs, clock()) ?? [],
        ),
      ),
    matchingRefs: (ref, prefix) =>
      call(ref, 'refs', () =>
        demoBranches(ref.repo)
          .filter((b) => b.startsWith(prefix))
          .map((b) => ({
            ref: `refs/heads/${b}`,
            object: { sha: sha(b.length) },
          })),
      ),
    // `cell...source` (spec.md §2.7): `ahead_by` counts source commits
    // the cell lacks (how far behind); the reverse compare lists the
    // cell's own commits.
    compare: (ref, base, head) =>
      call(ref, 'compare', () => {
        const forward = isForward(base, head);
        const stageId = stageForBranch(forward ? base : head);
        const { behind, ahead } = stageId
          ? stalenessCounts(scenarioFor(ref.repo, stageId))
          : { behind: 0, ahead: 0 };
        const [aheadBy, behindBy] = forward ? [behind, ahead] : [ahead, behind];
        return fetched({
          ahead_by: aheadBy,
          behind_by: behindBy,
          html_url: `https://github.com/acme/${ref.repo}/compare/${base}...${head}`,
          commits: subjects(aheadBy, head),
        });
      }),
    branchesPage: (ref) =>
      call(ref, 'branches', () =>
        fetched(
          demoBranches(ref.repo).map((name) => ({
            name,
            commit: { sha: sha(name.length) },
          })),
        ),
      ),
    reposPage: () =>
      call({ owner: 'acme', repo: '' }, 'repos', () =>
        fetched(
          DEMO_GITHUB_REPOS.map((name) => ({
            full_name: `acme/${name}`,
            name,
            private: true,
            html_url: `https://github.com/acme/${name}`,
            owner: { login: 'acme' },
          })),
        ),
      ),
    getTokenExpiration: () => undefined,
  };
}
