/**
 * Scenario validation (spec.md §3.14 *Scenario*): the schema's defaults
 * and ranges, and every pinned event naming a repo, branch, workflow or
 * app branch the scenario defines.
 */
import { describe, expect, it } from 'vitest';

import { acmeScenario } from '@/demo/scenarios/acme';
import { measureScenario } from '@/demo/scenarios/measure';
import { TINY_REPO, tinyScenario } from '@/test/simScenario';

import { DemoScenarioSchema } from './scenario';

describe('scenario validation', () => {
  it('fills defaults: private repos, success-only patterns, waits', () => {
    const s = tinyScenario();
    const repo = s.github.repos.find((r) => r.fullName === 'acme/zeta');
    expect(repo).toMatchObject({ private: true, workflows: [] });
    expect(s.github.tokens[0]?.rejected).toBe(false);
    expect(s.github.repos[0]?.workflows[0]?.outcomes).toEqual({
      failure: 0,
      cancelled: 0,
    });
    expect(s.aws.apps[0]?.branches[0]?.outcomes).toEqual({
      failure: 0,
      cancelled: 0,
    });
  });

  it('rejects a range whose min exceeds its max, and a bad repo name', () => {
    const input = tinyScenario();
    const bad = (repo: object) =>
      DemoScenarioSchema.safeParse({
        ...input,
        github: { ...input.github, repos: [repo] },
      }).success;
    expect(
      bad({
        fullName: 'acme/x',
        branches: [{ name: 'dev', commitsEveryMs: [5, 1] }],
      }),
    ).toBe(false);
    expect(bad({ fullName: 'acme', branches: [{ name: 'dev' }] })).toBe(false);
    expect(
      bad({
        fullName: 'acme/x',
        branches: [{ name: 'dev', commitsEveryMs: [1, 5] }],
      }),
    ).toBe(true);
  });

  it('names every undefined repo branch, workflow and app branch', () => {
    expect(() =>
      tinyScenario({
        pinned: [
          { kind: 'commit', repo: TINY_REPO, branch: 'gone', at: 0 },
          { kind: 'commit', repo: 'acme/nope', branch: 'main', at: 0 },
          { kind: 'promote', repo: TINY_REPO, from: 'dev', to: 'gone2', at: 0 },
          {
            kind: 'run',
            repo: TINY_REPO,
            branch: 'dev',
            workflow: 'Nope',
            at: 0,
          },
          { kind: 'appJob', appId: 'app1', branch: 'gone3', at: 0 },
          { kind: 'appJob', appId: 'nope', branch: 'main', at: 0 },
        ],
      }),
    ).toThrow(
      'Scenario refers to undefined branch acme/app:gone, branch acme/nope:main, branch acme/app:gone2, workflow acme/app:Nope, app branch app1/gone3, app branch nope/main',
    );
  });

  it('accepts the shipped and measurement scenarios', () => {
    expect(acmeScenario.dashboard.rows.length).toBeGreaterThan(0);
    expect(measureScenario.dashboard.rows).toHaveLength(19);
    expect(measureScenario.dashboard.stages).toHaveLength(6);
  });
});
