/**
 * A small simulated world for engine and request tests (spec.md §3.14):
 * one deployable repo (dev and main, a two-job workflow on both), a
 * faulted repo, a repo the token can't see, a rejected token, and one
 * Amplify app building `main` from the deployable repo. Tests override
 * any part.
 *
 * @module
 */
import { HOUR, MINUTE } from '@/demo/scenarios/pipeline';
import {
  type DemoScenario,
  type DemoScenarioInput,
  parseScenario,
} from '@/demo/sim/scenario';

export const TINY_TOKEN = 'tiny-token';
export const TINY_REJECTED = 'tiny-rejected';
export const TINY_KEY_ID = 'TINYKEY0001';
export const TINY_ACCOUNT = '999999999999';
export const TINY_REPO = 'acme/app';

/** Two one-minute jobs, `deploy` then `test`, on dev and main. */
export const tinyWorkflow = {
  name: 'Deploy',
  on: ['dev', 'main'],
  jobs: [
    { name: 'deploy', durationMs: [MINUTE, MINUTE] },
    { name: 'test', durationMs: [MINUTE, MINUTE] },
  ],
  queueMs: [10_000, 10_000],
  gapMs: [5_000, 5_000],
} satisfies NonNullable<
  DemoScenarioInput['github']['repos'][number]['workflows']
>[number];

export function tinyScenario(
  over: Partial<DemoScenarioInput> = {},
): DemoScenario {
  return parseScenario({
    seed: 7,
    historyMs: HOUR,
    github: {
      tokens: [
        {
          id: 'gh',
          secret: TINY_TOKEN,
          repos: [TINY_REPO, 'acme/broken', 'acme/zeta'],
        },
        {
          id: 'bad',
          secret: TINY_REJECTED,
          repos: [TINY_REPO],
          rejected: true,
        },
      ],
      repos: [
        {
          fullName: TINY_REPO,
          branches: [{ name: 'dev' }, { name: 'main' }],
          workflows: [tinyWorkflow],
        },
        {
          fullName: 'acme/broken',
          branches: [{ name: 'main' }],
          fault: 'serverError',
        },
        { fullName: 'acme/hidden', branches: [{ name: 'main' }] },
        { fullName: 'acme/zeta', branches: [{ name: 'main' }] },
      ],
    },
    aws: {
      keys: [
        {
          id: 'aws',
          accessKeyId: TINY_KEY_ID,
          secret: 'tiny-secret',
          account: TINY_ACCOUNT,
        },
      ],
      apps: [
        {
          account: TINY_ACCOUNT,
          region: 'us-east-1',
          appId: 'app1',
          name: 'app',
          repository: `https://github.com/${TINY_REPO}`,
          branches: [
            { name: 'main', durationMs: [MINUTE, MINUTE], queueMs: [0, 0] },
          ],
        },
      ],
    },
    promotions: [],
    pinned: [],
    dashboard: { id: 'tiny', name: 'Tiny' },
    ...over,
  });
}
