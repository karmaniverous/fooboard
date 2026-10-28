/**
 * A run's jobs from the cache (spec.md §3.1): keyed by run attempt, a
 * query per page (page 1, then each next page while `Link` says the list
 * goes on). The run's full record exists once every page has landed. A
 * failed jobs read drops its cached data: the cell shows the failure,
 * not stale jobs (Decision 26); a rate limit keeps it. Pure.
 *
 * @module
 */
import { attemptOf, type Job, type WorkflowRun } from '@/lib/github';
import { githubSnapshot } from '@/query/cache';
import type { GithubRequest } from '@/query/keys';

import { fullRecord } from './githubCandidates';
import type { GithubContext } from './githubRow';
import { type FailureOutcome, failureOutcome } from './providerOutcome';

export interface RunJobs {
  /** The jobs pages to observe. */
  requests: GithubRequest[];
  /** The full record, once every page landed. */
  full?: ReturnType<typeof fullRecord>;
  failure?: FailureOutcome;
}

/** `run`'s jobs as far as they've landed. */
export function jobsOf(ctx: GithubContext, run: WorkflowRun): RunJobs {
  const requests: GithubRequest[] = [];
  const pages: Job[][] = [];
  for (let page = 1; ; page += 1) {
    const request = {
      call: 'jobs',
      repo: ctx.repo,
      runId: run.id,
      attempt: attemptOf(run),
      page,
    } as const;
    requests.push(request);
    const snap = githubSnapshot(ctx.client, ctx.credentialId, request);
    const failure = failureOutcome(snap.failed, snap.error);
    if (failure) return { requests, failure };
    if (!snap.data) return { requests };
    pages.push(snap.data.data);
    if (!snap.data.hasNext) break;
  }
  // One page keeps its array, so the full record stays memoized.
  const jobs = pages.length === 1 ? (pages[0] ?? []) : pages.flat();
  return { requests, full: fullRecord(ctx.source, run, jobs) };
}
