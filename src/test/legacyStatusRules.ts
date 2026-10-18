/**
 * Today's (pre-A§4.3.6) GitHub phase tests and status rules (A§4.3.1,
 * A§4.3.3), frozen as the reference the bundled *GitHub deploy and test*
 * status set is checked against. Test-only; the board no longer uses them.
 *
 * @module
 */
import { max } from 'radash';

import type { PhaseTests } from '@/domain/config/legacyV2';
import type { MatchTest } from '@/domain/config/matchTest';
import { latestAttemptJobs } from '@/domain/derivation/latestAttempt';
import type { GithubWorkflowJob } from '@/domain/derivation/types';
import { matchesAny } from '@/domain/matching/matchTest';

/** The two fixed phases, in order (spec.md §4.3.1: deploy, then test). */
type Phase = 'deploy' | 'test';

/** A job that matched a phase, paired with that phase. */
export interface RelevantJob {
  job: GithubWorkflowJob;
  phase: Phase;
}

const IGNORED_CONCLUSIONS = new Set(['skipped', 'neutral', 'stale']);

/** Which phase a job's name matches, if any. A job matching both phase
 * tests counts as `test` (spec.md §4.3.1). */
function jobPhase(
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

/** Cell status vocabulary (spec.md §3), in the order the rules test for them. */
export type CellStatus =
  'failure' | 'cancelled' | 'started' | 'success' | 'partialSuccess' | 'queued';

/** A job's mapped state (spec.md §4.3.3). */
type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

/** Map one job's status/conclusion to its state (spec.md §4.3.3: `queued`,
 * `waiting`, `pending`, `requested` statuses and `action_required` all
 * count as queued, which covers approval waits). */
function jobState(job: GithubWorkflowJob): JobState {
  if (job.conclusion === 'action_required') return 'queued';
  if (job.conclusion === 'success') return 'succeeded';
  if (job.conclusion && FAILED_CONCLUSIONS.has(job.conclusion)) return 'failed';
  if (job.conclusion === 'cancelled') return 'cancelled';
  if (job.status === 'in_progress') return 'running';
  return 'queued';
}

/** The run's final phase: `test` if any relevant job is a test job,
 * otherwise `deploy` (spec.md §4.3.3). */
function finalPhase(jobs: readonly RelevantJob[]): Phase {
  return jobs.some((j) => j.phase === 'test') ? 'test' : 'deploy';
}

const PHASE_ORDER: readonly Phase[] = ['deploy', 'test'];

function finishedAt(job: GithubWorkflowJob): number {
  const time = job.completedAt ?? job.startedAt;
  return time ? new Date(time).getTime() : 0;
}

/** Pick the latest-finishing job among candidates (spec.md §4.3.3). Ties
 * are broken by phase order: phases run deploy then test, so on equal
 * times the later phase counts as finishing last. */
function latestByPhaseOrder(candidates: readonly RelevantJob[]): RelevantJob {
  // Sort key: finish time, then phase index as the tie-breaker.
  const key = (j: RelevantJob): number =>
    finishedAt(j.job) * PHASE_ORDER.length + PHASE_ORDER.indexOf(j.phase);
  return max(candidates, key) ?? candidates[0];
}

/** A cell's status and the job that determined it. `phase` is the
 * determining job's phase: the determining job supplies the phase label
 * (spec.md §4.3.3), so Partial success after a deploy reads `deploy`. */
export interface GithubCellStatus {
  status: CellStatus;
  phase: Phase;
  determiningJob: GithubWorkflowJob;
}

function determinedBy(
  status: CellStatus,
  candidates: readonly RelevantJob[],
): GithubCellStatus {
  const { job, phase } = latestByPhaseOrder(candidates);
  return { status, phase, determiningJob: job };
}

const EARLY_RULES = [
  ['failed', 'failure'],
  ['cancelled', 'cancelled'],
  ['running', 'started'],
] as const satisfies readonly (readonly [JobState, CellStatus])[];

/** Derive a cell's status from a run's relevant jobs (spec.md §4.3.3 rules
 * 1-5, first that applies), or `undefined` if there are none (the caller
 * shows an empty state instead). */
export function deriveGithubCellStatus(
  jobs: readonly RelevantJob[],
): GithubCellStatus | undefined {
  if (jobs.length === 0) return undefined;
  const inState = (state: JobState): RelevantJob[] =>
    jobs.filter((j) => jobState(j.job) === state);

  for (const [state, status] of EARLY_RULES) {
    const matching = inState(state);
    if (matching.length > 0) return determinedBy(status, matching);
  }

  const succeeded = inState('succeeded');
  if (succeeded.length > 0) {
    const phase = finalPhase(jobs);
    const finalPhaseSucceeded = succeeded.some((j) => j.phase === phase);
    return determinedBy(
      finalPhaseSucceeded ? 'success' : 'partialSuccess',
      succeeded,
    );
  }
  return determinedBy('queued', jobs);
}
