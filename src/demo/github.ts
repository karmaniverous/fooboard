/**
 * Demo GitHub provider (spec.md C-23): implements the `GitHubReader` port
 * from the demo scenarios, returning REST-shaped payloads so the real
 * mapping and derivation code runs unchanged. Two rows fail on purpose
 * (`legacy-billing`: rejected credential; `flaky-svc`: server error), and
 * three runs are deliberately unmapped, one per reason (a `hotfix/*`
 * branch, a lint-only run, and another service's deploy in the keyed row's
 * repo).
 *
 * @module
 */
import { alphabetical } from 'radash';

import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { GitHubReader, RepoRef } from '@/lib/github/reader';
import type { Job, WorkflowRun } from '@/lib/github/schemas';

import { DEMO_GITHUB_REPOS, DEMO_KEYED_REPO, DEMO_STAGE_IDS } from './board';
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

/** Create the demo GitHub reader; `clock` drives scenario progress. */
/** Plausible commit messages for the demo's richest detail (C-13 rung 5). */
const DEMO_MESSAGES = [
  'Fix flaky checkout test',
  'Bump dependencies',
  'Add retry to payment webhook',
  'Tune cache headers',
  'Refactor auth middleware',
  'Release notes for 24.3',
];

export function createDemoGitHubReader(
  clock: () => number = Date.now,
): GitHubReader {
  const startMs = clock();
  const budget = (): RateLimitBudget => ({
    limit: 5000,
    remaining: 4870,
    reset: Math.floor(clock() / 1000) + 3600,
    used: 130,
    status: 'ok',
  });
  const guard = ({ repo }: RepoRef, path: string): void => {
    if (repo === 'legacy-billing') throw new GitHubAuthError(path);
    if (repo === 'flaky-svc') throw new GitHubHttpError(path, 502);
  };
  const call = <T>(ref: RepoRef, path: string, fn: () => T): Promise<T> => {
    try {
      guard(ref, path);
      return Promise.resolve(fn());
    } catch (err) {
      return Promise.reject(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  };

  return {
    listWorkflowRuns: (ref) =>
      call(ref, 'runs', () => demoRuns(ref.repo, startMs).map((d) => d.run)),
    listRunJobs: (ref, runId) =>
      call(
        ref,
        'jobs',
        () =>
          demoRuns(ref.repo, startMs)
            .find((d) => d.run.id === runId)
            ?.jobs(startMs, clock()) ?? [],
      ),
    listWorkflows: (ref) =>
      call(ref, 'workflows', () => [
        {
          id: 1,
          name: 'Deploy',
          path: '.github/workflows/deploy.yml',
          state: 'active',
        },
      ]),
    matchingRefs: (ref, prefix) =>
      call(ref, 'refs', () =>
        demoBranches(ref.repo)
          .filter((b) => b.startsWith(prefix))
          .map((b) => ({
            ref: `refs/heads/${b}`,
            object: { sha: sha(b.length) },
          })),
      ),
    // Called as compare(cell branch...source branch) (spec.md §4.3.5):
    // `aheadBy` counts source commits the cell lacks, i.e. how far behind.
    compare: (ref, base, head) =>
      call(ref, 'compare', () => {
        const stageId = stageForBranch(base);
        const { behind, ahead } = stageId
          ? stalenessCounts(scenarioFor(ref.repo, stageId))
          : { behind: 0, ahead: 0 };
        const subjects = (n: number, branch: string): string[] =>
          Array.from(
            { length: n },
            (_, i) => `${branch} change ${String(i + 1)}`,
          );
        return {
          aheadBy: behind,
          behindBy: ahead,
          htmlUrl: `https://github.com/acme/${ref.repo}/compare/${base}...${head}`,
          aheadCommitSubjects: subjects(behind, head),
          behindCommitSubjects: subjects(ahead, base),
        };
      }),
    listBranches: (ref) =>
      call(ref, 'branches', () =>
        demoBranches(ref.repo).map((name) => ({
          name,
          commit: { sha: sha(name.length) },
        })),
      ),
    listRepos: () =>
      Promise.resolve(
        DEMO_GITHUB_REPOS.map((name) => ({
          full_name: `acme/${name}`,
          name,
          private: true,
          html_url: `https://github.com/acme/${name}`,
          owner: { login: 'acme' },
        })),
      ),
    getBudget: budget,
    readRateLimit: () => Promise.resolve(budget()),
    getTokenExpiration: () => undefined,
  };
}
