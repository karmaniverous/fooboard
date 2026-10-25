/**
 * Simulated workflow runs (spec.md §3.14 *Engine*): a push to a branch a
 * workflow's globs match starts a run (attempt 1); its jobs follow one
 * another after the queue wait and gaps; a failing job skips the rest, a
 * cancel cancels them; a pinned run starts on the branch's head as a
 * dispatch, with its own waits, durations, outcome and slow jobs; ids
 * are stable per repo whatever else is simulated.
 */
import { describe, expect, it } from 'vitest';

import { MINUTE } from '@/demo/scenarios/pipeline';
import { TINY_REPO, tinyScenario, tinyWorkflow } from '@/test/simScenario';

import { branchAt, repoHistory } from './history';
import { jobAt, repoRuns, runAt } from './runs';
import type { DemoScenario, DemoScenarioInput } from './scenario';

const runsOf = (s: DemoScenario, until = 0) => {
  const repo = s.github.repos.find((r) => r.fullName === TINY_REPO);
  if (!repo) throw new Error('no repo');
  const history = repoHistory(s, s.seed, repo, until);
  return { runs: repoRuns(s, s.seed, repo, history), history };
};

type Pinned = DemoScenarioInput['pinned'];
const commitAt = (branch: string, at: number): Pinned[number] => ({
  kind: 'commit',
  repo: TINY_REPO,
  branch,
  at,
});

describe('workflow runs', () => {
  it('starts a run for each push to a branch its globs match', () => {
    const s = tinyScenario({
      github: {
        ...tinyScenario().github,
        repos: tinyScenario().github.repos.map((r) =>
          r.fullName === TINY_REPO
            ? { ...r, branches: [...r.branches, { name: 'feature/x' }] }
            : r,
        ),
      },
      pinned: [
        commitAt('dev', -10 * MINUTE),
        commitAt('feature/x', -9 * MINUTE),
        commitAt('dev', -8 * MINUTE),
      ],
    });
    const { runs, history } = runsOf(s);
    expect(runs.map((r) => [r.branch, r.createdAt, r.number, r.event])).toEqual(
      [
        ['dev', -10 * MINUTE, 1, 'push'],
        ['dev', -8 * MINUTE, 2, 'push'],
      ],
    );
    expect(runs[1]?.head).toBe(branchAt(history, 'dev', 0)?.head);
    expect(runs[1]?.id).toBe((runs[0]?.id ?? 0) + 1);
    expect(runs[0]?.jobs.map((j) => j.id)).toEqual([
      (runs[0]?.id ?? 0) * 10 + 1,
      (runs[0]?.id ?? 0) * 10 + 2,
    ]);
  });

  it('runs the jobs one after another after the queue wait and gap', () => {
    const { runs } = runsOf(
      tinyScenario({ pinned: [commitAt('dev', -10 * MINUTE)] }),
    );
    const run = runs[0];
    const t0 = -10 * MINUTE;
    // queue 10 s, deploy 1 min, gap 5 s, test 1 min.
    expect(
      run.jobs.map((j) => [j.name, j.startAt, j.endAt, j.conclusion]),
    ).toEqual([
      ['deploy', t0 + 10_000, t0 + 70_000, 'success'],
      ['test', t0 + 75_000, t0 + 135_000, 'success'],
    ]);
    expect(runAt(run, t0)).toEqual({
      status: 'queued',
      conclusion: null,
      updatedAt: t0,
    });
    expect(runAt(run, t0 + 10_000)).toMatchObject({
      status: 'in_progress',
      updatedAt: t0 + 10_000,
    });
    expect(jobAt(run.jobs[1] ?? run.jobs[0], t0 + 72_000)).toEqual({
      status: 'queued',
      conclusion: null,
    });
    expect(runAt(run, t0 + 72_000)).toMatchObject({
      status: 'in_progress',
      updatedAt: t0 + 70_000,
    });
    expect(runAt(run, t0 + 135_000)).toEqual({
      status: 'completed',
      conclusion: 'success',
      updatedAt: t0 + 135_000,
    });
  });

  it('skips the jobs after a failure, and cancels those after a cancel', () => {
    const fail = (outcome: 'failure' | 'cancelled'): Pinned[number] => ({
      kind: 'run',
      repo: TINY_REPO,
      branch: 'main',
      workflow: 'Deploy',
      at: -10 * MINUTE,
      outcome,
      job: 0,
      queueMs: 0,
      durationsMs: [MINUTE, MINUTE],
    });
    const [failed] = runsOf(tinyScenario({ pinned: [fail('failure')] })).runs;
    const t0 = -10 * MINUTE;
    expect(failed.jobs.map((j) => [j.startAt, j.endAt, j.conclusion])).toEqual([
      [t0, t0 + MINUTE, 'failure'],
      [null, t0 + MINUTE, 'skipped'],
    ]);
    expect(jobAt(failed.jobs[1], t0 + 1)).toEqual({
      status: 'queued',
      conclusion: null,
    });
    expect(runAt(failed, 0)).toMatchObject({
      status: 'completed',
      conclusion: 'failure',
    });
    const [cancelled] = runsOf(
      tinyScenario({ pinned: [fail('cancelled')] }),
    ).runs;
    // Cancelled half way through its first job.
    expect(cancelled.jobs.map((j) => [j.endAt, j.conclusion])).toEqual([
      [t0 + MINUTE / 2, 'cancelled'],
      [t0 + MINUTE / 2, 'cancelled'],
    ]);
    expect(runAt(cancelled, 0).conclusion).toBe('cancelled');
  });

  it("starts a pinned run on the branch's head as a dispatch, its job the last by default", () => {
    const s = tinyScenario({
      pinned: [
        commitAt('main', -20 * MINUTE),
        {
          kind: 'run',
          repo: TINY_REPO,
          branch: 'main',
          workflow: 'Deploy',
          at: -5 * MINUTE,
          outcome: 'failure',
          gapMs: 0,
          slowJobsMs: 5000,
        },
        // Before history starts: the branch has no head yet, so no run.
        {
          kind: 'run',
          repo: TINY_REPO,
          branch: 'main',
          workflow: 'Deploy',
          at: -2 * 60 * MINUTE,
        },
        {
          kind: 'run',
          repo: TINY_REPO,
          branch: 'main',
          workflow: 'Deploy',
          at: 5 * MINUTE,
        },
      ],
    });
    const { runs, history } = runsOf(s);
    const dispatched = runs.filter((r) => r.event === 'workflow_dispatch');
    // The later run is planned ahead, as the history is generated ahead.
    expect(dispatched.map((r) => r.createdAt)).toEqual([
      -5 * MINUTE,
      5 * MINUTE,
    ]);
    const pinned = dispatched[0];
    expect(pinned).toMatchObject({
      branch: 'main',
      createdAt: -5 * MINUTE,
      slowJobsMs: 5000,
    });
    expect(pinned.head).toBe(branchAt(history, 'main', -5 * MINUTE)?.head);
    expect(pinned.jobs.map((j) => j.conclusion)).toEqual([
      'success',
      'failure',
    ]);
    expect((pinned.jobs[1].startAt ?? 0) - pinned.jobs[0].endAt).toBe(0);
    expect(dispatched[1].number).toBe(3);
  });

  it('draws outcomes from the workflow pattern', () => {
    const withPattern = (outcomes: { failure: number; cancelled: number }) =>
      tinyScenario({
        github: {
          ...tinyScenario().github,
          repos: tinyScenario().github.repos.map((r) =>
            r.fullName === TINY_REPO
              ? { ...r, workflows: [{ ...tinyWorkflow, outcomes }] }
              : r,
          ),
        },
        pinned: [
          commitAt('dev', -30 * MINUTE),
          commitAt('dev', -20 * MINUTE),
          commitAt('dev', -10 * MINUTE),
        ],
      });
    const ending = (s: DemoScenario) =>
      runsOf(s).runs.map((r) => runAt(r, 0).conclusion);
    expect(ending(withPattern({ failure: 1, cancelled: 0 }))).toEqual([
      'failure',
      'failure',
      'failure',
    ]);
    expect(ending(withPattern({ failure: 0, cancelled: 1 }))).toEqual([
      'cancelled',
      'cancelled',
      'cancelled',
    ]);
    expect(ending(withPattern({ failure: 0, cancelled: 0 }))).toEqual([
      'success',
      'success',
      'success',
    ]);
  });

  it("keeps a repo's run ids whatever other repos are simulated", () => {
    const base = tinyScenario({ pinned: [commitAt('dev', -MINUTE)] });
    const more = tinyScenario({
      pinned: [commitAt('dev', -MINUTE)],
      github: {
        ...base.github,
        repos: [
          { fullName: 'acme/first', branches: [{ name: 'dev' }] },
          ...base.github.repos,
        ],
      },
    });
    expect(runsOf(more).runs.map((r) => r.id)).toEqual(
      runsOf(base).runs.map((r) => r.id),
    );
    expect(runsOf(base).runs[0]?.id).toBeGreaterThan(100_000_000);
  });
});
