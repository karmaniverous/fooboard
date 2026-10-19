/**
 * Shared small fixture builders for derivation tests: typed GitHub run/job
 * builders imitating real field names and shapes (field names recorded via
 * `gh api repos/karmaniverous/fooboard/actions/runs`), trimmed to `acme/*`
 * scenarios for reusable workflows, matrix jobs, re-runs, approval waits
 * and skipped jobs (spec.md §8 step 3). Not itself a test file; imported by
 * the derivation `*.test.ts` files to avoid duplicating fixture shapes.
 *
 * @module
 */
import type { StatusSet } from '@/domain/config/statusSets';
import { findStatusSet } from '@/domain/statuses/resolve';

import type {
  GithubRunWithJobs,
  GithubWorkflowJob,
  GithubWorkflowRun,
} from './types';

let nextId = 1;

/** Build a minimal GitHub Actions workflow run, with sensible defaults. */
function makeRun(
  overrides: Partial<GithubWorkflowRun> = {},
): GithubWorkflowRun {
  const id = nextId++;
  return {
    id,
    workflowName: 'CI',
    headBranch: 'main',
    headSha: `sha-${String(id)}`,
    createdAt: '2026-10-01T00:00:00Z',
    event: 'push',
    htmlUrl: `https://github.com/acme/api-core/actions/runs/${String(id)}`,
    ...overrides,
  };
}

/** Build a minimal GitHub Actions job, with sensible defaults (a
 * successful `deploy` job on attempt 1). */
export function makeJob(
  overrides: Partial<GithubWorkflowJob> = {},
): GithubWorkflowJob {
  const id = nextId++;
  return {
    id,
    runId: 1,
    runAttempt: 1,
    name: 'deploy',
    status: 'completed',
    conclusion: 'success',
    startedAt: '2026-10-01T00:01:00Z',
    completedAt: '2026-10-01T00:02:00Z',
    htmlUrl: `https://github.com/acme/api-core/actions/runs/1/job/${String(id)}`,
    ...overrides,
  };
}

/** Pair a run with its jobs, as `GithubRunWithJobs` derivation consumes. */
export function makeRunWithJobs(
  runOverrides: Partial<GithubWorkflowRun>,
  jobs: GithubWorkflowJob[],
): GithubRunWithJobs {
  return { run: makeRun(runOverrides), jobs };
}

const preset = (id: string): StatusSet => {
  const set = findStatusSet(id);
  if (!set) throw new Error(`missing preset ${id}`);
  return set;
};

/** The bundled *GitHub deploy and test* and *Amplify* sets (A§4.3.6). */
export const githubSet = preset('github-deploy-test');
export const amplifySet = preset('amplify');
