/**
 * Pick the newest Amplify job by start time (spec.md §4: an Amplify cell's
 * job is the newest by start time). Pure; jobs without a start time sort
 * last.
 *
 * @module
 */
import type { JobSummary } from '@aws-sdk/client-amplify';

function startedAt(job: JobSummary): number {
  return job.startTime ? new Date(job.startTime).getTime() : 0;
}

/** Return the job with the latest `startTime`, or `undefined` if none. */
export function newestJob(jobs: readonly JobSummary[]): JobSummary | undefined {
  return jobs.reduce<JobSummary | undefined>(
    (best, job) => (best && startedAt(best) >= startedAt(job) ? best : job),
    undefined,
  );
}
