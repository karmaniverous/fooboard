/**
 * Job-state mapping and status rules for a GitHub cell (spec.md §4.3.3):
 * each relevant job maps to queued/running/succeeded/failed/cancelled; the
 * run's final phase and the five status rules then decide the cell's
 * status, phase and determining job. Pure; no network.
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

/** Pick the latest-finishing job among candidates, ties broken by phase
 * order (deploy before test, spec.md §4.3.3). */
function latestByPhaseOrder(candidates: readonly RelevantJob[]): RelevantJob {
  return candidates.reduce((best, current) => {
    const bestTime = finishedAt(best.job);
    const currentTime = finishedAt(current.job);
    if (currentTime !== bestTime)
      return currentTime > bestTime ? current : best;
    const bestOrder = PHASE_ORDER.indexOf(best.phase);
    const currentOrder = PHASE_ORDER.indexOf(current.phase);
    return currentOrder < bestOrder ? current : best;
  });
}

/** The cell status, final phase and determining job for a run's relevant
 * jobs (spec.md §4.3.3 rules 1-5), or `undefined` if there are no relevant
 * jobs (caller shows an empty state instead). */
export interface GithubCellStatus {
  status: CellStatus;
  phase: Phase;
  determiningJob: GithubWorkflowJob;
}

export function deriveGithubCellStatus(
  jobs: readonly RelevantJob[],
): GithubCellStatus | undefined {
  if (jobs.length === 0) return undefined;
  const phase = finalPhase(jobs);
  const states = jobs.map((j) => ({ ...j, state: jobState(j.job) }));

  const failed = states.filter((j) => j.state === 'failed');
  if (failed.length > 0) {
    return {
      status: 'failure',
      phase,
      determiningJob: latestByPhaseOrder(failed).job,
    };
  }
  const cancelled = states.filter((j) => j.state === 'cancelled');
  if (cancelled.length > 0) {
    return {
      status: 'cancelled',
      phase,
      determiningJob: latestByPhaseOrder(cancelled).job,
    };
  }
  const running = states.filter((j) => j.state === 'running');
  if (running.length > 0) {
    return {
      status: 'started',
      phase,
      determiningJob: latestByPhaseOrder(running).job,
    };
  }
  const succeeded = states.filter((j) => j.state === 'succeeded');
  if (succeeded.length > 0) {
    const finalPhaseSucceeded = succeeded.filter((j) => j.phase === phase);
    const winner =
      finalPhaseSucceeded.length > 0 ? finalPhaseSucceeded : succeeded;
    return {
      status: finalPhaseSucceeded.length > 0 ? 'success' : 'partialSuccess',
      phase,
      determiningJob: latestByPhaseOrder(winner).job,
    };
  }
  return {
    status: 'queued',
    phase,
    determiningJob: latestByPhaseOrder(states).job,
  };
}
