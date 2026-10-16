/**
 * Map `GitHubReader` output (spec.md §5) into the small derivation input
 * types `src/domain/derivation/types.ts` defines (spec.md §4.3). Kept as
 * its own module, per spec.md §8 step 4, so the adapter's full payload
 * shapes never leak into the pure derivation layer: only these mappers
 * know both shapes.
 *
 * @module
 */
import type {
  GithubJobConclusion,
  GithubJobStatus,
  GithubRunWithJobs,
  GithubWorkflowJob,
  GithubWorkflowRun,
} from '@/domain/derivation/types';

import type { Job, WorkflowRun } from './schemas';

/** GitHub's job `status` values (spec.md §4.3.3) as the REST API sends them;
 * anything else is defensively treated as `queued` since GitHub has added
 * new transitional statuses before (e.g. `requested`, `waiting`). */
const KNOWN_JOB_STATUSES: readonly GithubJobStatus[] = [
  'queued',
  'in_progress',
  'completed',
  'waiting',
  'pending',
  'requested',
];

function mapJobStatus(status: string): GithubJobStatus {
  return (KNOWN_JOB_STATUSES as readonly string[]).includes(status)
    ? (status as GithubJobStatus)
    : 'queued';
}

const KNOWN_JOB_CONCLUSIONS: readonly Exclude<GithubJobConclusion, null>[] = [
  'success',
  'failure',
  'neutral',
  'cancelled',
  'skipped',
  'timed_out',
  'action_required',
  'stale',
  'startup_failure',
];

function mapJobConclusion(conclusion: string | null): GithubJobConclusion {
  if (conclusion === null) return null;
  return (KNOWN_JOB_CONCLUSIONS as readonly string[]).includes(conclusion)
    ? (conclusion as GithubJobConclusion)
    : null;
}

/** Map one REST workflow run into the run fields derivation needs. The
 * run's `name` is GitHub's workflow display name (spec.md §4.3.1 workflow
 * filter); a run without one (rare, e.g. a deleted workflow) maps to an
 * empty string, which matches no workflow filter test. */
export function mapWorkflowRun(run: WorkflowRun): GithubWorkflowRun {
  return {
    id: run.id,
    workflowName: run.name ?? '',
    headBranch: run.head_branch,
    headSha: run.head_sha,
    createdAt: run.created_at,
    event: run.event,
    htmlUrl: run.html_url,
  };
}

/** Map one REST job into the job fields derivation needs. */
export function mapWorkflowJob(job: Job): GithubWorkflowJob {
  return {
    id: job.id,
    runId: job.run_id,
    runAttempt: job.run_attempt ?? 1,
    name: job.name,
    status: mapJobStatus(job.status),
    conclusion: mapJobConclusion(job.conclusion),
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    // Jobs always have an `html_url` in practice; the schema types it
    // nullable defensively (per the REST docs), so a missing link is
    // tolerated here as an empty string, which the UI treats as "no link"
    // rather than throwing.
    htmlUrl: job.html_url ?? '',
  };
}

/** Combine a run (spec.md §4.3.1: `pull_request` and `pull_request_target`
 * runs are excluded, by the caller, before reaching here) with its jobs
 * into one `GithubRunWithJobs`, as derivation consumes it. */
export function mapRunWithJobs(
  run: WorkflowRun,
  jobs: readonly Job[],
): GithubRunWithJobs {
  return {
    run: mapWorkflowRun(run),
    jobs: jobs.map(mapWorkflowJob),
  };
}
