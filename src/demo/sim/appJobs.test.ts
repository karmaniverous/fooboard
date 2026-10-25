/**
 * Simulated Amplify jobs (spec.md §3.14 *Engine*): an app builds a branch
 * on each push to it in the scenario repo it names, on its own schedule
 * when its repo isn't simulated, and at each pinned job; ids count up per
 * branch; a job is pending, running, then succeeded, failed or cancelled.
 */
import { describe, expect, it } from 'vitest';

import { MINUTE } from '@/demo/scenarios/pipeline';
import { TINY_REPO, tinyScenario } from '@/test/simScenario';

import { appBranchJobs, appJobStatus } from './appJobs';
import { branchAt, repoHistory } from './history';
import type { App, DemoScenario } from './scenario';

const appOf = (s: DemoScenario): App => s.aws.apps[0];

describe('Amplify jobs', () => {
  it("builds a branch on each push to it in the app's repo", () => {
    const s = tinyScenario({
      pinned: [
        { kind: 'commit', repo: TINY_REPO, branch: 'main', at: -10 * MINUTE },
        { kind: 'commit', repo: TINY_REPO, branch: 'dev', at: -9 * MINUTE },
        { kind: 'commit', repo: TINY_REPO, branch: 'main', at: -5 * MINUTE },
      ],
    });
    const jobs = appBranchJobs(s, s.seed, appOf(s), 'main', 0);
    const repo = s.github.repos.find((r) => r.fullName === TINY_REPO);
    const history = repo && repoHistory(s, s.seed, repo, 0);
    expect(
      jobs.map((j) => [j.id, j.createdAt, j.startAt, j.endAt, j.outcome]),
    ).toEqual([
      ['1', -10 * MINUTE, -10 * MINUTE, -9 * MINUTE, 'success'],
      ['2', -5 * MINUTE, -5 * MINUTE, -4 * MINUTE, 'success'],
    ]);
    expect(jobs[1]?.commit).toBe(history && branchAt(history, 'main', 0)?.head);
    expect(appBranchJobs(s, s.seed, appOf(s), 'nope', 0)).toEqual([]);
  });

  it('builds on its own schedule when its repo is not simulated', () => {
    const base = tinyScenario();
    const app = {
      ...appOf(base),
      repository: undefined,
      branches: [
        {
          name: 'main',
          durationMs: [MINUTE, MINUTE] as [number, number],
          everyMs: [10 * MINUTE, 10 * MINUTE] as [number, number],
          outcomes: { failure: 0, cancelled: 1 },
          queueMs: [MINUTE, MINUTE] as [number, number],
        },
      ],
    };
    const s = tinyScenario({ aws: { ...base.aws, apps: [app] } });
    const jobs = appBranchJobs(s, s.seed, appOf(s), 'main', 0);
    // An hour of history, one build every ten minutes.
    expect(jobs.map((j) => j.createdAt)).toEqual(
      [-50, -40, -30, -20, -10, 0].map((m) => m * MINUTE),
    );
    expect(jobs[0]?.commit.message).toBe('Update content');
    expect(jobs[0]?.commit.sha).toMatch(/^[0-9a-f]{40}$/);
    // Cancelled half way through.
    expect((jobs[0]?.endAt ?? 0) - (jobs[0]?.startAt ?? 0)).toBe(MINUTE / 2);
    expect(jobs.every((j) => j.outcome === 'cancelled')).toBe(true);
  });

  it('builds a pinned job, on the repo head or a commit of its own', () => {
    const base = tinyScenario();
    const pinned = (appId: string) =>
      ({
        kind: 'appJob',
        appId,
        branch: 'main',
        at: -3 * MINUTE,
        outcome: 'failure',
        queueMs: 30_000,
        durationMs: 2 * MINUTE,
      }) as const;
    const s = tinyScenario({ pinned: [pinned('app1')] });
    const [job] = appBranchJobs(s, s.seed, appOf(s), 'main', 0);
    expect(job).toMatchObject({
      createdAt: -3 * MINUTE,
      startAt: -150_000,
      endAt: -30_000,
      outcome: 'failure',
    });
    expect(job.commit.n).toBe(0);
    const orphan = { ...appOf(base), repository: undefined };
    const s2 = tinyScenario({
      aws: { ...base.aws, apps: [orphan] },
      pinned: [pinned('app1')],
    });
    expect(
      appBranchJobs(s2, s2.seed, appOf(s2), 'main', 0)[0]?.commit.message,
    ).toBe('Redeploy');
  });

  it('is pending, running, then ends as drawn', () => {
    const job = {
      id: '1',
      commit: { n: 0, sha: 's', at: 0, message: 'm' },
      createdAt: 0,
      startAt: 10,
      endAt: 20,
    };
    expect(appJobStatus({ ...job, outcome: 'success' }, 9)).toBe('PENDING');
    expect(appJobStatus({ ...job, outcome: 'success' }, 10)).toBe('RUNNING');
    expect(appJobStatus({ ...job, outcome: 'success' }, 20)).toBe('SUCCEED');
    expect(appJobStatus({ ...job, outcome: 'failure' }, 20)).toBe('FAILED');
    expect(appJobStatus({ ...job, outcome: 'cancelled' }, 20)).toBe(
      'CANCELLED',
    );
  });

  it('draws failures from the branch pattern', () => {
    const base = tinyScenario();
    const app = {
      ...appOf(base),
      repository: undefined,
      branches: [
        {
          name: 'main',
          durationMs: [MINUTE, MINUTE] as [number, number],
          everyMs: [10 * MINUTE, 10 * MINUTE] as [number, number],
          outcomes: { failure: 1, cancelled: 0 },
          queueMs: [0, 0] as [number, number],
        },
      ],
    };
    const s = tinyScenario({ aws: { ...base.aws, apps: [app] } });
    expect(
      appBranchJobs(s, s.seed, appOf(s), 'main', 0).every(
        (j) => j.outcome === 'failure',
      ),
    ).toBe(true);
  });
});
