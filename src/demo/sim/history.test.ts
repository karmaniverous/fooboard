/**
 * A simulated repo's git history (spec.md §3.14 *Engine*): every branch
 * starts at one root commit; commits land at seeded intervals on the
 * branches that take them; promotions fast-forward, merge when the target
 * has commits of its own, and do nothing when there is nothing new;
 * pinned events happen at their times; compares count both ways; and the
 * timeline is the same however far it has been generated.
 */
import { describe, expect, it } from 'vitest';

import { HOUR, MINUTE } from '@/demo/scenarios/pipeline';
import { TINY_REPO, tinyScenario } from '@/test/simScenario';

import { branchAt, compareAt, repoHistory } from './history';
import type { DemoScenario } from './scenario';

const historyOf = (s: DemoScenario, until: number, seed = s.seed) => {
  const repo = s.github.repos.find((r) => r.fullName === TINY_REPO);
  if (!repo) throw new Error('no repo');
  return repoHistory(s, seed, repo, until);
};

describe('repo history', () => {
  it('starts every branch at one root commit when history starts', () => {
    const h = historyOf(tinyScenario(), 0);
    expect(branchAt(h, 'dev', -HOUR - 1)).toBeUndefined();
    expect(branchAt(h, 'dev', 0)?.head).toMatchObject({
      n: 0,
      at: -HOUR,
      message: 'Initial commit',
    });
    expect(branchAt(h, 'main', 0)?.head.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(h.pushes).toEqual([]);
    expect(branchAt(h, 'nope', 0)).toBeUndefined();
  });

  it('lands a pinned commit and compares both ways', () => {
    const s = tinyScenario({
      pinned: [
        {
          kind: 'commit',
          repo: TINY_REPO,
          branch: 'dev',
          at: -MINUTE,
          message: 'Add a thing',
        },
      ],
    });
    const h = historyOf(s, 0);
    expect(branchAt(h, 'dev', -2 * MINUTE)?.head.n).toBe(0);
    expect(branchAt(h, 'dev', -MINUTE)?.head).toMatchObject({
      n: 1,
      message: 'Add a thing',
    });
    expect(h.pushes).toEqual([
      { at: -MINUTE, branch: 'dev', head: h.commits[1] },
    ]);
    expect(compareAt(h, 'main', 'dev', 0)).toEqual({
      ahead: [h.commits[1]],
      behind: [],
    });
    expect(compareAt(h, 'dev', 'main', 0)).toEqual({
      ahead: [],
      behind: [h.commits[1]],
    });
    expect(compareAt(h, 'main', 'gone', 0)).toBeUndefined();
    expect(compareAt(h, 'gone', 'main', 0)).toBeUndefined();
  });

  it('fast-forwards a promotion, and skips one with nothing new', () => {
    const s = tinyScenario({
      pinned: [
        {
          kind: 'promote',
          repo: TINY_REPO,
          from: 'dev',
          to: 'main',
          at: -5 * MINUTE,
        },
        { kind: 'commit', repo: TINY_REPO, branch: 'dev', at: -4 * MINUTE },
        {
          kind: 'promote',
          repo: TINY_REPO,
          from: 'dev',
          to: 'main',
          at: -3 * MINUTE,
        },
      ],
    });
    const h = historyOf(s, 0);
    // The first promotion had nothing to move: one push from the commit,
    // one from the second promotion.
    expect(h.pushes.map((p) => [p.branch, p.at])).toEqual([
      ['dev', -4 * MINUTE],
      ['main', -3 * MINUTE],
    ]);
    expect(branchAt(h, 'main', 0)?.head).toBe(branchAt(h, 'dev', 0)?.head);
    expect(compareAt(h, 'main', 'dev', 0)).toEqual({ ahead: [], behind: [] });
  });

  it('merges a promotion onto a target with commits of its own', () => {
    const s = tinyScenario({
      pinned: [
        {
          kind: 'commit',
          repo: TINY_REPO,
          branch: 'main',
          at: -5 * MINUTE,
          message: 'Hotfix',
        },
        {
          kind: 'commit',
          repo: TINY_REPO,
          branch: 'dev',
          at: -4 * MINUTE,
          message: 'Feature',
        },
        {
          kind: 'promote',
          repo: TINY_REPO,
          from: 'dev',
          to: 'main',
          at: -3 * MINUTE,
        },
      ],
    });
    const h = historyOf(s, 0);
    const main = branchAt(h, 'main', 0);
    expect(main?.head.message).toBe("Merge branch 'dev' into main");
    expect([...(main?.commits ?? [])].sort()).toEqual([0, 1, 2, 3]);
    // main has the hotfix and the merge; dev lacks both (diverged once dev moves).
    expect(
      compareAt(h, 'main', 'dev', 0)?.behind.map((c) => c.message),
    ).toEqual(['Hotfix', "Merge branch 'dev' into main"]);
  });

  it('puts a commit before a promotion at the same time', () => {
    const s = tinyScenario({
      pinned: [
        {
          kind: 'promote',
          repo: TINY_REPO,
          from: 'dev',
          to: 'main',
          at: -MINUTE,
        },
        { kind: 'commit', repo: TINY_REPO, branch: 'dev', at: -MINUTE },
      ],
    });
    const h = historyOf(s, 0);
    expect(branchAt(h, 'main', 0)?.head.n).toBe(1);
  });

  it('lands commits at seeded intervals and promotes on schedule', () => {
    const s = tinyScenario({
      historyMs: 2 * HOUR,
      github: {
        ...tinyScenario().github,
        repos: tinyScenario().github.repos.map((r) =>
          r.fullName === TINY_REPO
            ? {
                ...r,
                branches: [
                  { name: 'dev', commitsEveryMs: [10 * MINUTE, 20 * MINUTE] },
                  { name: 'main' },
                ],
              }
            : r,
        ),
      },
      promotions: [
        { from: 'dev', to: 'main', everyMs: 30 * MINUTE },
        { from: 'dev', to: 'nowhere', everyMs: MINUTE },
      ],
    });
    const h = historyOf(s, 0);
    const commits = h.commits.slice(1);
    const gaps = commits.slice(1).map((c, i) => c.at - (commits[i]?.at ?? 0));
    expect(commits.length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(10 * MINUTE);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(20 * MINUTE);
    const promotions = h.pushes
      .filter((p) => p.branch === 'main')
      .map((p) => p.at);
    expect(promotions.length).toBeGreaterThanOrEqual(3);
    for (const [i, t] of promotions.slice(1).entries())
      expect(t - (promotions[i] ?? 0)).toBe(30 * MINUTE);
    // Another seed, another history; the same seed, the same one.
    expect(historyOf(s, 0, 8).commits.map((c) => c.at)).not.toEqual(
      h.commits.map((c) => c.at),
    );
    expect(historyOf(tinyScenario({ ...s }), 0).commits).toEqual(h.commits);
  });

  it('keeps the timeline the same however far it is generated', () => {
    const s = tinyScenario({
      github: {
        ...tinyScenario().github,
        repos: tinyScenario().github.repos.map((r) =>
          r.fullName === TINY_REPO
            ? {
                ...r,
                branches: [
                  { name: 'dev', commitsEveryMs: [MINUTE, 3 * MINUTE] },
                  { name: 'main' },
                ],
              }
            : r,
        ),
      },
    });
    const short = historyOf(s, 0);
    expect(historyOf(s, -HOUR)).toBe(short); // generated far enough already
    const long = historyOf(s, 3 * HOUR);
    expect(long.horizon).toBeGreaterThanOrEqual(3 * HOUR);
    const prefix = long.commits.filter((c) => c.at <= short.horizon);
    expect(prefix).toEqual(short.commits);
  });
});
