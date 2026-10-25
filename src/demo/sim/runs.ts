/**
 * Simulated workflow runs (spec.md §3.14 *Engine*): every push to a branch
 * a workflow's `on` globs match starts a run of it, and every pinned run
 * starts at its time on the branch's head (as a manual dispatch would).
 * A run's jobs follow one another after a queue wait and gaps drawn from
 * the workflow's ranges; its outcome is drawn from the workflow's pattern
 * (or pinned): a failing or cancelled job skips or cancels the jobs after
 * it. No scenario re-runs a workflow, so every run is attempt 1. A run's
 * and a job's state at a time is a pure function of that time.
 *
 * @module
 */
import { matchesBranchPattern } from '@/domain/matching/branchPattern';

import { branchAt, type Commit, type Push, type RepoHistory } from './history';
import { between, hash32, type Random, seededRandom } from './random';
import type {
  DemoScenario,
  PinnedEvent,
  Repo,
  RunOutcome,
  Workflow,
} from './scenario';

/** A job's ending: an outcome, or `skipped` after an earlier failure. */
type Conclusion = RunOutcome | 'skipped';

export interface SimJob {
  id: number;
  name: string;
  /** When it starts; `null`: never (skipped or cancelled first). */
  startAt: number | null;
  endAt: number;
  conclusion: Conclusion;
}

export interface SimRun {
  id: number;
  /** 1-based, in the order the repo's runs were created. */
  number: number;
  workflow: Workflow;
  workflowId: number;
  branch: string;
  head: Commit;
  createdAt: number;
  event: 'push' | 'workflow_dispatch';
  jobs: SimJob[];
  /** Its jobs answer this much later (a pinned run's `slowJobsMs`). */
  slowJobsMs: number;
}

/** Room for a repo's runs under its id base. */
const RUN_ID_SPACE = 10_000;
/** Spread of repo id bases, so ids look like GitHub's (9 digits). */
const REPO_ID_SPREAD = 90_000;
const REPO_ID_MIN = 10_000;
/** Room for a run's jobs under its id. */
const JOB_ID_SPACE = 10;

/** The run id base of a repo: stable, whatever else is simulated. */
const runIdBase = (repo: string): number =>
  ((hash32(repo) % REPO_ID_SPREAD) + REPO_ID_MIN) * RUN_ID_SPACE;

/** How a run is planned: its waits, durations and outcome. */
interface Plan {
  queueMs: number;
  gapsMs: number[];
  durationsMs: number[];
  outcome: RunOutcome;
  /** The job the outcome falls on. */
  job: number;
}

/** A plan drawn from the workflow's ranges and pattern. */
function drawPlan(w: Workflow, random: Random): Plan {
  const roll = random();
  const outcome: RunOutcome =
    roll < w.outcomes.failure
      ? 'failure'
      : roll < w.outcomes.failure + w.outcomes.cancelled
        ? 'cancelled'
        : 'success';
  return {
    queueMs: between(random, w.queueMs),
    gapsMs: w.jobs.map(() => between(random, w.gapMs)),
    durationsMs: w.jobs.map((j) => between(random, j.durationMs)),
    outcome,
    job: Math.floor(random() * w.jobs.length),
  };
}

/** A pinned run's plan: its own values, else the drawn ones. */
function pinnedPlan(
  w: Workflow,
  e: Extract<PinnedEvent, { kind: 'run' }>,
  drawn: Plan,
): Plan {
  const gap = e.gapMs;
  return {
    queueMs: e.queueMs ?? drawn.queueMs,
    gapsMs: gap === undefined ? drawn.gapsMs : w.jobs.map(() => gap),
    durationsMs: w.jobs.map(
      (_, i) => e.durationsMs?.[i] ?? drawn.durationsMs[i],
    ),
    outcome: e.outcome,
    job: Math.min(e.job ?? w.jobs.length - 1, w.jobs.length - 1),
  };
}

/** The jobs of a run created at `createdAt` under `plan`. */
function jobsOf(
  w: Workflow,
  id: number,
  createdAt: number,
  plan: Plan,
): SimJob[] {
  const jobs: SimJob[] = [];
  let t = createdAt + plan.queueMs;
  let stoppedAt: number | undefined;
  w.jobs.forEach((spec, i) => {
    const jobId = id * JOB_ID_SPACE + i + 1;
    if (stoppedAt !== undefined) {
      const conclusion = plan.outcome === 'cancelled' ? 'cancelled' : 'skipped';
      jobs.push({
        id: jobId,
        name: spec.name,
        startAt: null,
        endAt: stoppedAt,
        conclusion,
      });
      return;
    }
    if (i > 0) t += plan.gapsMs[i] ?? 0;
    const duration = plan.durationsMs[i] ?? 0;
    const decisive = i === plan.job && plan.outcome !== 'success';
    const endAt =
      t +
      (decisive && plan.outcome === 'cancelled'
        ? Math.round(duration / 2)
        : duration);
    jobs.push({
      id: jobId,
      name: spec.name,
      startAt: t,
      endAt,
      conclusion: decisive ? plan.outcome : 'success',
    });
    if (decisive) stoppedAt = endAt;
    t = endAt;
  });
  return jobs;
}

interface Start {
  at: number;
  branch: string;
  head: Commit;
  workflow: Workflow;
  workflowIndex: number;
  event: SimRun['event'];
  pinned?: Extract<PinnedEvent, { kind: 'run' }>;
  /** Stream name for its draws. */
  stream: string;
}

/** Every run start of `repo` up to the history's horizon, in order. */
function starts(
  scenario: DemoScenario,
  repo: Repo,
  history: RepoHistory,
): Start[] {
  const list: Start[] = [];
  history.pushes.forEach((p: Push, i) => {
    repo.workflows.forEach((w, workflowIndex) => {
      if (w.on.some((glob) => matchesBranchPattern(glob, p.branch)))
        list.push({
          at: p.at,
          branch: p.branch,
          head: p.head,
          workflow: w,
          workflowIndex,
          event: 'push',
          stream: `push:${String(i)}`,
        });
    });
  });
  scenario.pinned.forEach((e, i) => {
    if (e.kind !== 'run' || e.repo !== repo.fullName || e.at > history.horizon)
      return;
    const head = branchAt(history, e.branch, e.at)?.head;
    // parseScenario has checked the workflow exists.
    const workflow = repo.workflows.find((w) => w.name === e.workflow);
    const workflowIndex = workflow ? repo.workflows.indexOf(workflow) : -1;
    if (head && workflow)
      list.push({
        at: e.at,
        branch: e.branch,
        head,
        workflow,
        workflowIndex,
        event: 'workflow_dispatch',
        pinned: e,
        stream: `pinned:${String(i)}`,
      });
  });
  return list.sort((a, b) => a.at - b.at); // stable: ties keep list order
}

const cache = new WeakMap<RepoHistory, SimRun[]>();

/** Every run of `repo` its history (up to its horizon) starts, oldest first. */
export function repoRuns(
  scenario: DemoScenario,
  seed: number,
  repo: Repo,
  history: RepoHistory,
): SimRun[] {
  const hit = cache.get(history);
  if (hit) return hit;
  const base = runIdBase(repo.fullName);
  const runs = starts(scenario, repo, history).map((s, i): SimRun => {
    const { workflow } = s;
    const drawn = drawPlan(
      workflow,
      seededRandom(seed, `${repo.fullName}:run:${s.stream}:${workflow.name}`),
    );
    const plan = s.pinned ? pinnedPlan(workflow, s.pinned, drawn) : drawn;
    const id = base + i + 1;
    return {
      id,
      number: i + 1,
      workflow,
      workflowId: base + s.workflowIndex + 1,
      branch: s.branch,
      head: s.head,
      createdAt: s.at,
      event: s.event,
      jobs: jobsOf(workflow, id, s.at, plan),
      slowJobsMs: s.pinned?.slowJobsMs ?? 0,
    };
  });
  cache.set(history, runs);
  return runs;
}

/** A job's state at `t`. */
export function jobAt(
  job: SimJob,
  t: number,
): {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: Conclusion | null;
} {
  if (t >= job.endAt)
    return { status: 'completed', conclusion: job.conclusion };
  if (job.startAt !== null && t >= job.startAt)
    return { status: 'in_progress', conclusion: null };
  return { status: 'queued', conclusion: null };
}

/** A run's state at `t`: queued until a job starts, in progress until
 * every job ends, then concluded by its first non-success job. */
export function runAt(
  run: SimRun,
  t: number,
): {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: RunOutcome | null;
  updatedAt: number;
} {
  const states = run.jobs.map((j) => jobAt(j, t));
  const times = run.jobs
    .flatMap((j) => [j.startAt ?? run.createdAt, j.endAt])
    .filter((x) => x <= t);
  const updatedAt = Math.max(run.createdAt, ...times);
  if (states.every((s) => s.status === 'completed')) {
    const ending = run.jobs.find(
      (j) => j.conclusion !== 'success' && j.conclusion !== 'skipped',
    );
    return {
      status: 'completed',
      conclusion:
        ending && ending.conclusion !== 'skipped'
          ? ending.conclusion
          : 'success',
      updatedAt,
    };
  }
  const started = states.some((s) => s.status !== 'queued');
  return {
    status: started ? 'in_progress' : 'queued',
    conclusion: null,
    updatedAt,
  };
}
