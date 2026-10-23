/**
 * Demo GitHub provider (spec.md C-23): implements the `GitHubApi` request
 * port from the demo scenarios, returning REST-shaped payloads so the real
 * query layer, mapping and derivation code run unchanged. A run is in
 * progress while any of its jobs is. Two rows fail on purpose
 * (`legacy-billing`: rejected credential; `flaky-svc`: server error), and
 * three runs are deliberately unmapped, one per reason (a `hotfix/*`
 * branch, a lint-only run, and another service's deploy in the keyed row's
 * repo). One cell gets a newer run after the board has loaded, whose jobs
 * answer slowly (`addedRun.ts`).
 *
 * @module
 */
import { alphabetical } from 'radash';

import type { GitHubApi, RepoRef } from '@/lib/github/api';
import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { Job, WorkflowRun } from '@/lib/github/schemas';

import {
  ADDED_RUN_AT_MS,
  ADDED_RUN_CELL,
  ADDED_RUN_JOBS_DELAY_MS,
  addedRunShown,
  addedRunStates,
  sleep,
  type Wait,
} from './addedRun';
import {
  DEMO_GITHUB_REPOS,
  DEMO_KEYED_REPO,
  DEMO_STAGE_IDS,
  demoDashboard,
} from './board';
import {
  DEMO_MESSAGES,
  demoBudget,
  fetched,
  iso,
  restState,
  runAt,
  sha,
} from './githubPayloads';
import {
  type DemoJobState,
  jobStates,
  MINUTE,
  scenarioFor,
  stageBranch,
  stageForBranch,
  stalenessCounts,
} from './scenarios';

/** How long after its deploy job a run's test job starts. */
const TEST_AFTER_MS = 3 * MINUTE;

const repoIndex = (repo: string): number =>
  (DEMO_GITHUB_REPOS as readonly string[]).indexOf(repo);

interface DemoRun {
  run: WorkflowRun;
  jobs: (startMs: number, nowMs: number) => Job[];
  /** Listed only from this long after demo start; its jobs answer after
   * `ADDED_RUN_JOBS_DELAY_MS`. */
  addedAtMs?: number;
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
  /** The id of the run of stage number `s`. */
  const stageRunId = (s: number) => 1000 + r * 100 + s * 10;
  /** A stage run's deploy and test jobs, in `states`. */
  const deployAndTest = (
    id: number,
    states: ReturnType<typeof jobStates>,
    createdMs: number,
  ) => [
    job(id, 1, `deploy${key}`, states.deploy, createdMs),
    job(id, 2, `test${key}`, states.test, createdMs + TEST_AFTER_MS),
  ];

  DEMO_STAGE_IDS.forEach((stageId, s) => {
    const scenario = scenarioFor(repo, stageId);
    if (scenario === 'noBranch' || scenario === 'noRuns') return;
    const id = stageRunId(s);
    const live = scenario === 'started' || scenario === 'queued';
    const createdMs = live ? startMs - MINUTE : startMs - (s + 1) * 37 * MINUTE;
    runs.push({
      run: makeRun(id, stageBranch(stageId), createdMs),
      jobs: (start, now) =>
        deployAndTest(id, jobStates(scenario, now - start), createdMs),
    });
  });

  if (repo === ADDED_RUN_CELL.rowId) {
    // Next to its stage's own run id.
    const id = stageRunId(DEMO_STAGE_IDS.indexOf(ADDED_RUN_CELL.stageId)) + 5;
    const createdMs = startMs + ADDED_RUN_AT_MS;
    runs.push({
      run: makeRun(id, stageBranch(ADDED_RUN_CELL.stageId), createdMs),
      jobs: (start, now) =>
        deployAndTest(id, addedRunStates(now - start), createdMs),
      addedAtMs: ADDED_RUN_AT_MS,
    });
  }
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

/** Is `base...head` a cell compared with its source stage (the forward
 * compare), rather than the source compared with the cell? */
function isForward(base: string, head: string): boolean {
  const cell = stageForBranch(base);
  const source = demoDashboard.stages.find((s) => s.id === cell)?.sourceStageId;
  return source !== undefined && source === stageForBranch(head);
}

/** Create the demo GitHub request port; `clock` drives scenario
 * progress, every answer reports the demo budget to `onBudget`, and the
 * added run's jobs answer after `wait`. */
export function createDemoGitHubApi(
  clock: () => number = Date.now,
  onBudget: (budget: RateLimitBudget) => void = () => undefined,
  wait: Wait = sleep,
): GitHubApi {
  const startMs = clock();
  /** `repo`'s runs listed at the demo clock's time. */
  const listed = (repo: string) =>
    demoRuns(repo, startMs).filter(
      (d) => d.addedAtMs === undefined || addedRunShown(clock() - startMs),
    );
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
          listed(ref.repo).map((d) => runAt(d.run, d.jobs(startMs, clock()))),
        ),
      ),
    jobsPage: async (ref, runId) => {
      const found = listed(ref.repo).find((d) => d.run.id === runId);
      if (found?.addedAtMs !== undefined) await wait(ADDED_RUN_JOBS_DELAY_MS);
      return call(ref, 'jobs', () =>
        fetched(found?.jobs(startMs, clock()) ?? []),
      );
    },
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
