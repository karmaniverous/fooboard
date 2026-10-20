/**
 * The demo dashboard (spec.md C-23): a fictional `acme/*` organisation, 19
 * rows by 6 stages shaped like a real pipeline (three preview
 * environments in a *Preview* column group, dev, release, prod; backend
 * and frontend row groups, the frontend overriding the release branch and
 * setting its own AWS key; one backend row keyed to its jobs),
 * used by *Try the demo*, tests, design proofs and screenshots. Every name is invented.
 *
 * @module
 */
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import { all, is } from '@/domain/model/ruleBuilders';

/** Credential reference ids the demo providers answer for. */
const DEMO_GITHUB_CREDENTIAL = 'demo-github';
const DEMO_AWS_CREDENTIAL = 'demo-aws';

/** GitHub repos (the *Backend* row group), in board order. */
export const DEMO_GITHUB_REPOS = [
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

/** Amplify rows: app ids per source, in the demo AWS account. */
export const DEMO_AMPLIFY_APPS = {
  'marketing-site': [{ region: 'us-east-1', appId: 'd1demomarketing' }],
  'partner-portal': [
    { region: 'us-east-1', appId: 'd1demopartnerus' },
    { region: 'eu-west-1', appId: 'd1demopartnereu' },
  ],
} as const;

/** The backend row whose repo also runs other services' jobs: its row key
 * test picks its own (`deploy (payments)`), so a job for another service
 * is unmapped with *no row key matches* (C-15). */
export const DEMO_KEYED_REPO = 'payments';

const github = DEMO_GITHUB_REPOS.map((name) => ({
  type: 'github' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  ...(name === DEMO_KEYED_REPO
    ? {
        itemRule: all(is(ITEM_NAME_PATH, `*${name}*`)),
      }
    : {}),
}));

const amplify = Object.entries(DEMO_AMPLIFY_APPS).map(([name, sources]) => ({
  type: 'amplify' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  sources: sources.map((s) => ({ ...s })),
}));

/** The demo dashboard, validated by the real schema. */
export const demoDashboard: Dashboard = DashboardSchema.parse({
  id: 'demo',
  name: 'Acme platform (demo)',
  rows: [...github, ...amplify],
  stages: [
    {
      id: 'bali',
      name: 'Bali',
      rules: branchRules('preview/bali'),
      sourceStageId: 'dev',
    },
    {
      id: 'spokane',
      name: 'Spokane',
      rules: branchRules('preview/spokane'),
      sourceStageId: 'dev',
    },
    {
      id: 'texas',
      name: 'Texas',
      rules: branchRules('preview/texas'),
      sourceStageId: 'dev',
    },
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
  // Backend services on GitHub Actions, frontends on Amplify, which
  // deploys releases from `preview/release` (a row-group override, C-14c).
  rowGroups: [
    {
      id: 'backend',
      label: 'Backend',
      memberIds: github.map((r) => r.id),
    },
    {
      id: 'frontend',
      label: 'Frontend',
      memberIds: amplify.map((r) => r.id),
      stageRules: { release: branchRules('preview/release') },
      // The frontends' AWS key is the group's, not the dashboard's (C-1a).
      defaultCredentials: { aws: DEMO_AWS_CREDENTIAL },
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
    { id: DEMO_GITHUB_CREDENTIAL, kind: 'github', label: 'Demo GitHub' },
    { id: DEMO_AWS_CREDENTIAL, kind: 'aws', label: 'Demo AWS' },
  ],
  defaultCredentials: { github: DEMO_GITHUB_CREDENTIAL },
});

/** The demo stage ids, in column order. */
export const DEMO_STAGE_IDS = demoDashboard.stages.map((s) => s.id);
