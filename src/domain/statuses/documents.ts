/**
 * The normalised documents a status test sees (spec.md A§4.3.6): fooboard's
 * own field names, stable across provider API changes.
 *
 * - A GitHub run: its workflow, event, branch and attempt, and the latest
 *   attempt's jobs that pass the row key tests, without `skipped`,
 *   `neutral` and `stale` jobs. Job statuses and conclusions are GitHub's.
 * - An Amplify job: its branch, status (Amplify's), commit and times.
 *
 * @module
 */
import type { MatchTest } from '@/domain/config/matchTest';
import { latestAttemptJobs } from '@/domain/derivation/githubPhase';
import type {
  AmplifyJobWithBranch,
  GithubRunWithJobs,
  GithubWorkflowJob,
} from '@/domain/derivation/types';
import { matchesAny } from '@/domain/matching/matchTest';

interface GithubJobDocument {
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GithubRunDocument {
  workflow: string;
  event: string;
  branch: string;
  attempt: number;
  jobs: GithubJobDocument[];
}

export interface AmplifyJobDocument {
  branch: string;
  status: string | null;
  commitId: string | null;
  startTime: string | null;
  endTime: string | null;
}

const IGNORED_CONCLUSIONS = new Set(['skipped', 'neutral', 'stale']);

/** The jobs of a run a row sees (each with its document). */
function rowJobs(
  { run, jobs }: GithubRunWithJobs,
  rowKeyTests: readonly MatchTest[],
): GithubWorkflowJob[] {
  return latestAttemptJobs(jobs).filter(
    (job) =>
      !IGNORED_CONCLUSIONS.has(job.conclusion ?? '') &&
      (rowKeyTests.length === 0 ||
        matchesAny(
          rowKeyTests,
          { jobName: job.name, workflowName: run.workflowName },
          false,
        )),
  );
}

/** A run's document for a row, or `undefined` when the row sees none of
 * its jobs (the run is not this row's). */
export function githubRunDocument(
  entry: GithubRunWithJobs,
  rowKeyTests: readonly MatchTest[],
): GithubRunDocument | undefined {
  const jobs = rowJobs(entry, rowKeyTests);
  if (jobs.length === 0) return undefined;
  return {
    workflow: entry.run.workflowName,
    event: entry.run.event,
    branch: entry.run.headBranch ?? '',
    attempt: Math.max(...jobs.map((j) => j.runAttempt)),
    jobs: jobs.map((j) => ({
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    })),
  };
}

export function amplifyJobDocument({
  branch,
  job,
}: AmplifyJobWithBranch): AmplifyJobDocument {
  return {
    branch,
    status: job.status ?? null,
    commitId: job.commitId ?? null,
    startTime: job.startTime?.toISOString() ?? null,
    endTime: job.endTime?.toISOString() ?? null,
  };
}
