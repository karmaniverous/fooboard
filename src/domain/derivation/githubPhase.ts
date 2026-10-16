/**
 * Phase classification for GitHub jobs (spec.md §4.3.1, §4.3.2): the latest
 * attempt's jobs, filtered to those with a phase and (for keyed rows) a
 * matching row key, ignoring `skipped`, `neutral` and `stale` conclusions.
 * Pure; no network.
 *
 * @module
 */
import type { PhaseTests } from '@/domain/config/mappingSettings';
import type { MatchTest } from '@/domain/config/matchTest';
import { matchesAny } from '@/domain/matching/matchTest';

import type { GithubWorkflowJob } from './types';

/** The two fixed phases, in order (spec.md §4.3.1: deploy, then test). */
export type Phase = 'deploy' | 'test';

/** A job that matched a phase, paired with that phase. */
export interface RelevantJob {
  job: GithubWorkflowJob;
  phase: Phase;
}

const IGNORED_CONCLUSIONS = new Set(['skipped', 'neutral', 'stale']);

/** Jobs of the run's latest attempt only (spec.md §4.3.2: `filter=latest`,
 * re-running a run updates it in place). */
export function latestAttemptJobs(
  jobs: readonly GithubWorkflowJob[],
): GithubWorkflowJob[] {
  if (jobs.length === 0) return [];
  const maxAttempt = Math.max(...jobs.map((job) => job.runAttempt));
  return jobs.filter((job) => job.runAttempt === maxAttempt);
}

/** Which phase a job's name matches, if any. A job matching both phase
 * tests counts as `test` (spec.md §4.3.1). */
export function jobPhase(
  job: GithubWorkflowJob,
  phases: PhaseTests,
): Phase | undefined {
  const context = { jobName: job.name, workflowName: '' };
  if (matchesAny(phases.test, context, false)) return 'test';
  if (matchesAny(phases.deploy, context, false)) return 'deploy';
  return undefined;
}

/**
 * The relevant jobs of a run (spec.md §4.3.2): latest attempt, matching a
 * phase and, for a keyed row, a row key test on job or workflow name. A
 * key-less row (`rowKeyTests` empty) sees all phase-matching jobs,
 * including ones that also match another row's key (spec.md §4.3.2 point 4).
 */
export function relevantJobs(
  jobs: readonly GithubWorkflowJob[],
  workflowName: string,
  phases: PhaseTests,
  rowKeyTests: readonly MatchTest[],
): RelevantJob[] {
  return latestAttemptJobs(jobs)
    .filter((job) => !IGNORED_CONCLUSIONS.has(job.conclusion ?? ''))
    .flatMap((job) => {
      const phase = jobPhase(job, phases);
      if (!phase) return [];
      if (rowKeyTests.length > 0) {
        const context = { jobName: job.name, workflowName };
        if (!matchesAny(rowKeyTests, context, false)) return [];
      }
      return [{ job, phase }];
    });
}
