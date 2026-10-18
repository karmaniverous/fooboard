/**
 * The normalised documents a status test sees (spec.md A§4.3.6): fooboard's
 * own field names, stable across provider API changes.
 *
 * - A GitHub run: its workflow, event, branch and attempt, and the latest
 *   attempt's jobs that pass the row key tests and the status set's job
 *   test, without `skipped`, `neutral` and `stale` jobs. Job statuses and conclusions are GitHub's.
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

import { passes } from './classify';

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

const jobDocument = (j: GithubWorkflowJob): GithubJobDocument => ({
  name: j.name,
  status: j.status,
  conclusion: j.conclusion,
  startedAt: j.startedAt,
  completedAt: j.completedAt,
});

/** The jobs of a run a row sees that the status set cares about: latest
 * attempt, not skipped, neutral or stale, passing the row key tests and
 * the set's job test. */
function relevantRowJobs(
  { run, jobs }: GithubRunWithJobs,
  rowKeyTests: readonly MatchTest[],
  jobTest: Record<string, unknown>,
): GithubWorkflowJob[] {
  return latestAttemptJobs(jobs).filter(
    (job) =>
      !IGNORED_CONCLUSIONS.has(job.conclusion ?? '') &&
      passes(jobTest, jobDocument(job)) &&
      (rowKeyTests.length === 0 ||
        matchesAny(
          rowKeyTests,
          { jobName: job.name, workflowName: run.workflowName },
          false,
        )),
  );
}

/** A run's document for a row and status set, or `undefined` when it has
 * no relevant jobs (the run is not the cell's, A§4.3.6). */
export function githubRunDocument(
  entry: GithubRunWithJobs,
  rowKeyTests: readonly MatchTest[],
  jobTest: Record<string, unknown> = {},
): GithubRunDocument | undefined {
  const jobs = relevantRowJobs(entry, rowKeyTests, jobTest);
  if (jobs.length === 0) return undefined;
  return {
    workflow: entry.run.workflowName,
    event: entry.run.event,
    branch: entry.run.headBranch ?? '',
    attempt: Math.max(...jobs.map((j) => j.runAttempt)),
    jobs: jobs.map(jobDocument),
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
