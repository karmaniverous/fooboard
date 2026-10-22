/**
 * GitHub cache fixtures for board model tests: the demo's REST payloads
 * seeded into a QueryClient (or a failure recorded for a key), and a
 * GitHub row context for the demo board, so derivation is tested against
 * the cache without fetching.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import { demoDashboard } from '@/demo/board';
import { createDemoGitHubApi } from '@/demo/github';
import { cellRulesFor } from '@/domain/config/cellRules';
import type { GithubRow } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import type { GithubContext } from '@/engine/githubRow';
import type { Job, WorkflowRun } from '@/lib/github';
import { githubKey, type GithubRequest } from '@/query/keys';

import { fetched } from './fakeReaders';

/** The demo board's GitHub token. */
export const DEMO_TOKEN = 'demo-github';

/** A demo GitHub row by id. */
export function demoGithubRow(id: string): GithubRow {
  const row = demoDashboard.rows.find((r) => r.id === id);
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
  source: sourceRuleFor(demoDashboard, 'github'),
  stages: demoDashboard.stages,
  rulesFor: (row, stageId) => cellRulesFor(demoDashboard, row, stageId),
  overBudget: false,
  openedAt: 0,
  ...overrides,
});

const api = createDemoGitHubApi(() => 0);
const ref = (repo: string) => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, repo: name };
};

/** The demo's runs of `repo` (`owner/name`). */
export async function demoRuns(repo: string): Promise<WorkflowRun[]> {
  const res = await api.runsPage(ref(repo), 1);
  return res.notModified ? [] : res.data;
}

/** The demo's jobs of a run. */
export async function demoJobs(repo: string, runId: number): Promise<Job[]> {
  const res = await api.jobsPage(ref(repo), runId, 1);
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

/** The jobs request of a run (page 1). */
export const jobsRequest = (
  repo: string,
  run: Pick<WorkflowRun, 'id' | 'run_attempt'>,
): GithubRequest => ({
  call: 'jobs',
  repo,
  runId: run.id,
  attempt: run.run_attempt ?? 1,
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
    seedJobs(client, repo, run, await demoJobs(repo, run.id));
  return runs;
}
