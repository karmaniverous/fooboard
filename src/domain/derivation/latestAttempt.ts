/**
 * The jobs of a GitHub run that count (spec.md A§4.3.2): the latest attempt
 * only, since re-running a run updates it in place. Pure.
 *
 * @module
 */
import type { GithubWorkflowJob } from './types';

/** Jobs of the run's latest attempt only (spec.md A§4.3.2: `filter=latest`,
 * re-running a run updates it in place). */
export function latestAttemptJobs(
  jobs: readonly GithubWorkflowJob[],
): GithubWorkflowJob[] {
  if (jobs.length === 0) return [];
  const maxAttempt = Math.max(...jobs.map((job) => job.runAttempt));
  return jobs.filter((job) => job.runAttempt === maxAttempt);
}
