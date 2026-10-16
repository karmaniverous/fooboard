/**
 * GitHub cell status (spec.md §4.3.3): map each relevant job to a state,
 * apply rules 1-5 in order, and pick the determining job, which supplies
 * the cell's phase label, link and time. Pure.
 *
 * @module
 */
import type { Phase, RelevantJob } from './githubPhase';
import type { GithubWorkflowJob } from './types';

/** Cell status vocabulary (spec.md §3), in the order the rules test for them. */
export type CellStatus =
  'failure' | 'cancelled' | 'started' | 'success' | 'partialSuccess' | 'queued';

/** A job's mapped state (spec.md §4.3.3). */
export type JobState =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

/** Map one job's status/conclusion to its state (spec.md §4.3.3: `queued`,
 * `waiting`, `pending`, `requested` statuses and `action_required` all
 * count as queued, which covers approval waits). */
export function jobState(job: GithubWorkflowJob): JobState {
  if (job.conclusion === 'action_required') return 'queued';
  if (job.conclusion === 'success') return 'succeeded';
  if (job.conclusion && FAILED_CONCLUSIONS.has(job.conclusion)) return 'failed';
  if (job.conclusion === 'cancelled') return 'cancelled';
  if (job.status === 'in_progress') return 'running';
  return 'queued';
}

/** The run's final phase: `test` if any relevant job is a test job,
 * otherwise `deploy` (spec.md §4.3.3). */
export function finalPhase(jobs: readonly RelevantJob[]): Phase {
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
  return candidates.reduce((best, current) => {
    const bestTime = finishedAt(best.job);
    const currentTime = finishedAt(current.job);
    if (currentTime !== bestTime)
      return currentTime > bestTime ? current : best;
    return PHASE_ORDER.indexOf(current.phase) > PHASE_ORDER.indexOf(best.phase)
      ? current
      : best;
  });
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
