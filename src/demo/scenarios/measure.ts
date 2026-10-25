/**
 * The measurement scenario (spec.md §3.14 *Measurement scenario*, Q29):
 * the 19 × 6 board of C-23 read through the simulator, for §3.5's demo
 * targets. Each repo's history is pinned: a commit on dev four hours
 * before the opening, promoted to every stage that its repo has; then
 * C-23's cells: two behind and one diverged, runs started, queued,
 * partial, failed and cancelled, branches missing and a branch no
 * workflow runs on, a rejected token and a faulted repo, three runs
 * unmapped on purpose, and a newer run on *web-app*'s prod 2.5 minutes
 * in whose jobs answer slowly. Development builds select it with
 * `?scenario=measure`; production bundles leave it out.
 *
 * @module
 */
import { parseScenario } from '@/demo/sim/scenario';

import { MEASURE_SCENARIO_MARKER } from './marker';
import {
  MEASURE_AMPLIFY_APPS,
  MEASURE_AWS,
  MEASURE_GITHUB,
  MEASURE_GITHUB_REPOS,
  MEASURE_REJECTED,
  measureDashboard,
} from './measureBoard';
import { measureCells, PREVIEWS, RELEASE } from './measureEvents';
import {
  acmeRepo,
  at,
  HOUR,
  MINUTE,
  promoted,
  type Step,
  workflow,
} from './pipeline';

const FRONTEND_RELEASE = 'preview/release';

/** Branches a backend repo lacks (C-23's *no branch* cells). */
const MISSING: Partial<Record<string, string[]>> = {
  'auth-service': [RELEASE],
  search: ['preview/texas'],
  'admin-portal': ['preview/texas'],
  'docs-site': [RELEASE],
};

/** Promotions from dev down a repo's stages, `minutes` after its commit. */
function steps(branches: readonly string[], release: string): Step[] {
  const has = (b: string) => branches.includes(b);
  return [
    ...PREVIEWS.filter(has).map((b, i): Step => ['dev', b, 10 + i * 5]),
    ...(has(release) ? [['dev', release, 40] as Step] : []),
    ...(has(release) ? [[release, 'main', 60] as Step] : []),
  ];
}

const backendBranches = (name: string) =>
  [
    'dev',
    ...PREVIEWS,
    RELEASE,
    'main',
    ...(name === 'api-core' ? ['hotfix/login'] : []),
  ].filter((b) => !(MISSING[name] ?? []).includes(b));

const deployTest = (key = '') =>
  [
    [`deploy${key}`, [2, 3]],
    [`test${key}`, [3, 4]],
  ] as [string, [number, number]][];

const backend = MEASURE_GITHUB_REPOS.map((name) => ({
  fullName: acmeRepo(name),
  branches: backendBranches(name).map((b) => ({ name: b })),
  workflows: [
    workflow(
      'Deploy',
      // inventory's Deploy never runs on preview/texas (C-23's *no runs*).
      name === 'inventory'
        ? ['dev', 'preview/bali', 'preview/spokane', 'release/*', 'main']
        : ['dev', 'preview/*', 'release/*', 'main', 'hotfix/*'],
      deployTest(name === 'payments' ? ' (payments)' : ''),
    ),
    ...(name === 'web-app'
      ? [workflow('Lint', ['dev'], [['lint', [1, 1]]])]
      : []),
    ...(name === 'payments'
      ? [workflow('Deploy refunds', ['dev'], [['deploy (refunds)', [2, 2]]])]
      : []),
  ],
  ...(name === 'flaky-svc' ? { fault: 'serverError' as const } : {}),
}));

const frontendBranches = ['dev', ...PREVIEWS, FRONTEND_RELEASE, 'main'];
const frontend = Object.keys(MEASURE_AMPLIFY_APPS).map((name) => ({
  fullName: acmeRepo(name),
  branches: frontendBranches
    .filter((b) => !(name === 'partner-portal' && b === 'preview/texas'))
    .map((b) => ({ name: b })),
}));

const history = [
  ...backend.flatMap((r) =>
    promoted(
      r.fullName,
      at(-240),
      'dev',
      steps(
        r.branches.map((b) => b.name),
        RELEASE,
      ),
    ),
  ),
  ...frontend.flatMap((r) =>
    promoted(
      r.fullName,
      at(-240),
      'dev',
      steps(
        r.branches.map((b) => b.name),
        FRONTEND_RELEASE,
      ),
    ),
  ),
];

const appBranch = (name: string) => ({
  name,
  durationMs: [3 * MINUTE, 4 * MINUTE] as [number, number],
});
const ACCOUNT = '111111111111';

export const measureScenario = parseScenario({
  seed: 29,
  historyMs: 6 * HOUR,
  github: {
    tokens: [
      {
        id: MEASURE_GITHUB,
        secret: 'demo-token-acme',
        repos: [...backend, ...frontend].map((r) => r.fullName),
      },
      {
        id: MEASURE_REJECTED,
        secret: 'demo-token-legacy',
        repos: [],
        rejected: true,
      },
    ],
    repos: [...backend, ...frontend],
  },
  aws: {
    keys: [
      {
        id: MEASURE_AWS,
        accessKeyId: 'DEMOACMEKEY0001',
        secret: 'demo-secret-acme',
        account: ACCOUNT,
      },
    ],
    apps: [
      {
        account: ACCOUNT,
        region: 'us-east-1',
        appId: 'd1demomarketing',
        name: 'marketing-site',
        repository: 'https://github.com/acme/marketing-site',
        branches: frontendBranches.map(appBranch),
      },
      {
        account: ACCOUNT,
        region: 'us-east-1',
        appId: 'd1demopartnerus',
        name: 'partner-portal',
        repository: 'https://github.com/acme/partner-portal',
        branches: frontendBranches
          .filter((b) => b !== 'preview/texas')
          .map(appBranch),
      },
      {
        account: ACCOUNT,
        region: 'eu-west-1',
        appId: MEASURE_SCENARIO_MARKER,
        name: 'partner-portal',
        branches: frontendBranches.map(appBranch),
      },
    ],
  },
  promotions: [],
  pinned: [...history, ...measureCells],
  dashboard: measureDashboard,
});

/** The measurement board, as the scenario parsed it. */
export const measureBoard = measureScenario.dashboard;
