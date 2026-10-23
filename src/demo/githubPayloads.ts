/**
 * REST-shaped pieces of the demo GitHub provider's answers (spec.md
 * C-23): timestamps, commit SHAs and messages, job and run states, the
 * answer envelope and the token budget.
 *
 * @module
 */
import type { Fetched } from '@/lib/github/api';
import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { Job, WorkflowRun } from '@/lib/github/schemas';

import type { DemoJobState } from './scenarios';

/** An ISO timestamp. */
export const iso = (ms: number): string => new Date(ms).toISOString();

/** A commit SHA from a seed. */
export const sha = (seed: number): string =>
  (seed * 2654435761).toString(16).padStart(8, '0').slice(-7) + 'a1b2c3d';

/** REST job status/conclusion for a demo job state. */
export function restState(
  state: DemoJobState,
): Pick<Job, 'status' | 'conclusion'> {
  if (state === 'waiting') return { status: 'waiting', conclusion: null };
  if (state === 'queued') return { status: 'queued', conclusion: null };
  if (state === 'running') return { status: 'in_progress', conclusion: null };
  return { status: 'completed', conclusion: state };
}

/** Plausible commit messages for the demo's richest detail (C-13 rung 5). */
export const DEMO_MESSAGES = [
  'Fix flaky checkout test',
  'Bump dependencies',
  'Add retry to payment webhook',
  'Tune cache headers',
  'Refactor auth middleware',
  'Release notes for 24.3',
];

/** A demo answer: never a 304, never paginated. */
export const fetched = <T>(data: T): Fetched<T> => ({
  notModified: false,
  data,
  etag: null,
  hasNext: false,
  redirected: false,
});

/** The demo's token budget at `now`: plenty left. */
export const demoBudget = (now: number): RateLimitBudget => ({
  limit: 5000,
  remaining: 4870,
  reset: Math.floor(now / 1000) + 3600,
  used: 130,
  status: 'ok',
});

/** `run` as GitHub reports it at `jobs`' states: in progress while any
 * job is; else completed, failed if any job failed. */
export function runAt(run: WorkflowRun, jobs: readonly Job[]): WorkflowRun {
  if (jobs.some((j) => j.status !== 'completed'))
    return { ...run, status: 'in_progress', conclusion: null };
  const failed = jobs.find((j) => j.conclusion !== 'success');
  return { ...run, conclusion: failed?.conclusion ?? run.conclusion };
}
