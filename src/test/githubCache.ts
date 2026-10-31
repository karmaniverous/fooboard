/**
 * GitHub cache fixtures for board model tests: the simulator's REST payloads
 * seeded into a QueryClient (or a failure recorded for a key), and a
 * GitHub row context for the demo board, so derivation is tested against
 * the cache without fetching.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import { measureBoard } from '@/demo/scenarios/measure';
import { cellRulesFor } from '@/domain/config/cellRules';
import type { GithubRow } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import type { GithubContext } from '@/engine/githubRow';
import { attemptOf, type Job, repoRef, type WorkflowRun } from '@/lib/github';
import { githubKey, type GithubRequest } from '@/query/keys';

import { fetched } from './fakeReaders';
import { simGitHubApi } from './simDemo';

/** The demo board's GitHub token. */
export const DEMO_TOKEN = 'demo-github';

/** A demo GitHub row by id. */
export function demoGithubRow(id: string): GithubRow {
  const row = measureBoard.rows.find((r) => r.id === id);
  if (row?.type !== 'github') throw new Error(`${id} is not a GitHub row`);
  return row;
}

/** A GitHub row context for `repo` on the demo board. */
export const demoContext = (
  client: QueryClient,
  repo: string,
  overrides: Partial<GithubContext> = {},
): GithubContext => ({
  client,
  credentialId: DEMO_TOKEN,
  repo,
  source: sourceRuleFor(measureBoard, 'github'),
  stages: measureBoard.stages,
  rulesFor: (row, stageId) => cellRulesFor(measureBoard, row, stageId),
  overBudget: false,
  now: 0,
  fetchStartedAt: () => undefined,
  boostOf: () => undefined,
  ...overrides,
});

const api = simGitHubApi();

/** The demo's runs of `repo` (`owner/name`). */
export async function demoRuns(repo: string): Promise<WorkflowRun[]> {
  const res = await api.runsPage(repoRef(repo), 1);
  return res.notModified ? [] : res.data;
}

/** A run, as far as its jobs request needs it. */
type RunRef = Pick<WorkflowRun, 'id' | 'run_attempt'>;

/** The demo's jobs of a run's attempt. */
export async function demoJobs(repo: string, run: RunRef): Promise<Job[]> {
  const res = await api.jobsPage(repoRef(repo), run.id, attemptOf(run), 1);
  return res.notModified ? [] : res.data;
}

/** Seed a runs page. */
export function seedRuns(
  client: QueryClient,
  repo: string,
  runs: WorkflowRun[],
  extra: Parameters<typeof fetched>[1] = {},
  page = 1,
): void {
  client.setQueryData(
    githubKey(DEMO_TOKEN, { call: 'runs', repo, page }),
    fetched(runs, extra),
  );
}

/** A runs page's query key as a string, to compare with `keyOf`. */
export const runsKey = (repo: string, page = 1): string =>
  JSON.stringify(['github', DEMO_TOKEN, { call: 'runs', repo, page }]);

/** A need's query key as a string. */
export const keyOf = (need: { key: unknown }): string =>
  JSON.stringify(need.key);

/** The jobs request of a run (page 1). */
export const jobsRequest = (
  repo: string,
  run: RunRef,
): Extract<GithubRequest, { call: 'jobs' }> => ({
  call: 'jobs',
  repo,
  runId: run.id,
  attempt: attemptOf(run),
  page: 1,
});

/** Seed a run's jobs. */
export function seedJobs(
  client: QueryClient,
  repo: string,
  run: WorkflowRun,
  jobs: Job[],
): void {
  client.setQueryData(
    githubKey(DEMO_TOKEN, jobsRequest(repo, run)),
    fetched(jobs),
  );
}

/** Record `error` as the latest fetch of `request`. */
export async function seedError(
  client: QueryClient,
  request: GithubRequest,
  error: Error,
): Promise<void> {
  await client
    .query({
      queryKey: githubKey(DEMO_TOKEN, request),
      queryFn: () => Promise.reject(error),
      retry: false,
    })
    .catch(() => undefined);
}

/** Seed `repo`'s demo runs and every run's jobs. */
export async function seedDemoRepo(
  client: QueryClient,
  repo: string,
): Promise<WorkflowRun[]> {
  const runs = await demoRuns(repo);
  seedRuns(client, repo, runs);
  for (const run of runs)
    seedJobs(client, repo, run, await demoJobs(repo, run));
  return runs;
}
