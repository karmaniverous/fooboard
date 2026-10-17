/**
 * Minimal provider input types for cell derivation (spec.md §4.3): the
 * GitHub Actions run/job fields fooboard actually uses, and the Amplify
 * job-summary type reused from the AWS SDK. Kept separate from the full
 * provider payloads (built in PR B) so derivation stays pure and testable
 * against small fixtures.
 *
 * @module
 */
import type { JobSummary as AmplifyJobSummary } from '@aws-sdk/client-amplify';

export type { JobSummary as AmplifyJobSummary } from '@aws-sdk/client-amplify';

/** GitHub event that triggered a workflow run. */
export type GithubRunEvent = string;

/** The run-level fields derivation needs from a GitHub Actions workflow run. */
export interface GithubWorkflowRun {
  id: number;
  /** The run's display name, used as the workflow name for the workflow filter. */
  workflowName: string;
  headBranch: string | null;
  headSha: string;
  /** The head commit's message (first line shown), when GitHub sends it. */
  headCommitMessage?: string;
  createdAt: string;
  event: GithubRunEvent;
  htmlUrl: string;
}

/** GitHub job status (spec.md §4.3.3). */
export type GithubJobStatus =
  'queued' | 'in_progress' | 'completed' | 'waiting' | 'pending' | 'requested';

/** GitHub job conclusion (spec.md §4.3.3), `null` while not completed. */
export type GithubJobConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'stale'
  | 'startup_failure'
  | null;

/** The job-level fields derivation needs from a GitHub Actions job. */
export interface GithubWorkflowJob {
  id: number;
  runId: number;
  /** Attempt number the job belongs to, for picking the latest attempt. */
  runAttempt: number;
  /** As GitHub displays it, e.g. `deploy`, `deploy / deploy`, `deploy (billing)`. */
  name: string;
  status: GithubJobStatus;
  conclusion: GithubJobConclusion;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string;
}

/** One run with all of its jobs (any attempt), as derivation needs them. */
export interface GithubRunWithJobs {
  run: GithubWorkflowRun;
  jobs: GithubWorkflowJob[];
}

/** An Amplify job summary with the branch it belongs to (ListJobs is
 * per-branch, so callers attach the branch name when combining sources). */
export interface AmplifyJobWithBranch {
  /** The row source (app) the job came from, so the link can target it. */
  source: { region: string; appId: string };
  branch: string;
  job: AmplifyJobSummary;
}
