/**
 * The measurement scenario's dashboard (spec.md §3.14 *Measurement
 * scenario*, Q29): the 19 × 6 board the N1–N3 numbers were taken on
 * (C-23): a *Preview* column group of bali, spokane and texas, then dev,
 * release and prod; a *Backend* row group of 17 GitHub repos (one keyed
 * to its own jobs, one read with a rejected token) and a *Frontend* row
 * group of 2 Amplify apps (one pinned in two regions) deploying releases
 * from `preview/release` with the group's AWS key. Development only, and
 * the board many tests read.
 *
 * @module
 */
import { DEMO_DASHBOARD_ID } from '@/demo/constants';
import type { DemoScenarioInput } from '@/demo/sim/scenario';
import { branchRules } from '@/domain/config/placement';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import { all, is } from '@/domain/model/ruleBuilders';

import { MEASURE_SCENARIO_MARKER } from './marker';

/** The board's credentials. */
export const MEASURE_GITHUB = 'demo-github';
export const MEASURE_AWS = 'demo-aws';
/** The token the scenario rejects (*legacy-billing*'s). */
export const MEASURE_REJECTED = 'demo-legacy';

/** GitHub repos (the *Backend* row group), in board order. */
export const MEASURE_GITHUB_REPOS = [
  'api-core',
  'web-app',
  'mobile-bff',
  'auth-service',
  'billing',
  'orders',
  'payments',
  'inventory',
  'shipping',
  'catalog',
  'search',
  'notifications',
  'analytics',
  'admin-portal',
  'docs-site',
  'legacy-billing',
  'flaky-svc',
] as const;

/** Amplify rows: the apps each pins. */
export const MEASURE_AMPLIFY_APPS = {
  'marketing-site': [{ region: 'us-east-1', appId: 'd1demomarketing' }],
  'partner-portal': [
    { region: 'us-east-1', appId: 'd1demopartnerus' },
    { region: 'eu-west-1', appId: MEASURE_SCENARIO_MARKER },
  ],
} as const;

/** The backend row whose repo also runs another service's jobs: its
 * item rule picks its own (`deploy (payments)`). */
const MEASURE_KEYED_REPO = 'payments';

/** The row read with the rejected token. */
const MEASURE_REJECTED_REPO = 'legacy-billing';

const github = MEASURE_GITHUB_REPOS.map((name) => ({
  type: 'github' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  ...(name === MEASURE_KEYED_REPO
    ? {
        settings: {
          itemRules: { github: all(is(ITEM_NAME_PATH, `*${name}*`)) },
        },
      }
    : name === MEASURE_REJECTED_REPO
      ? { settings: { githubToken: MEASURE_REJECTED } }
      : {}),
}));

const amplify = Object.entries(MEASURE_AMPLIFY_APPS).map(([name, sources]) => ({
  type: 'amplify' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  pinnedApps: sources.map((s) => ({ ...s })),
}));

const preview = (id: string, name: string) => ({
  id,
  name,
  rules: branchRules(`preview/${id}`),
  sourceStageId: 'dev',
});

export const measureDashboard: DemoScenarioInput['dashboard'] = {
  id: DEMO_DASHBOARD_ID,
  name: 'Acme platform (demo)',
  rows: [...github, ...amplify],
  stages: [
    preview('bali', 'Bali'),
    preview('spokane', 'Spokane'),
    preview('texas', 'Texas'),
    { id: 'dev', name: 'Dev', rules: branchRules('dev') },
    {
      id: 'release',
      name: 'Release',
      rules: branchRules('release/*'),
      sourceStageId: 'dev',
    },
    {
      id: 'prod',
      name: 'Prod',
      rules: branchRules('main'),
      sourceStageId: 'release',
    },
  ],
  rowGroups: [
    { id: 'backend', label: 'Backend', memberIds: github.map((r) => r.id) },
    {
      id: 'frontend',
      label: 'Frontend',
      memberIds: amplify.map((r) => r.id),
      stageRules: { release: branchRules('preview/release') },
      settings: { awsKey: MEASURE_AWS },
    },
  ],
  columnGroups: [
    {
      id: 'preview',
      label: 'Preview',
      memberIds: ['bali', 'spokane', 'texas'],
    },
  ],
  credentials: [
    { id: MEASURE_GITHUB, kind: 'github', label: 'Demo GitHub' },
    { id: MEASURE_REJECTED, kind: 'github', label: 'Legacy GitHub' },
    { id: MEASURE_AWS, kind: 'aws', label: 'Demo AWS' },
  ],
  settings: { githubToken: MEASURE_GITHUB },
};
