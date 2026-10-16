/**
 * The demo dashboard (spec.md C-23): a fictional `acme/*` organisation, 19
 * rows by 6 stages with row groups and a column divider, used by *Try the
 * demo*, tests, design proofs and screenshots. Every name is invented.
 *
 * @module
 */
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';

/** Credential reference ids the demo providers answer for. */
const DEMO_GITHUB_CREDENTIAL = 'demo-github';
const DEMO_AWS_CREDENTIAL = 'demo-aws';

/** GitHub repos, in board order, grouped by the row dividers below. */
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

const github = DEMO_GITHUB_REPOS.map((name) => ({
  type: 'github' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
}));

const amplify = Object.entries(DEMO_AMPLIFY_APPS).map(([name, sources]) => ({
  type: 'amplify' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  sources: sources.map((s) => ({ credentialId: DEMO_AWS_CREDENTIAL, ...s })),
}));

/** The demo dashboard, validated by the real schema. */
export const demoDashboard: Dashboard = DashboardSchema.parse({
  id: 'demo',
  name: 'Acme platform (demo)',
  rows: [...github, ...amplify],
  stages: [
    { id: 'dev', name: 'Dev', branchPattern: 'dev' },
    { id: 'test', name: 'Test', branchPattern: 'test', sourceStageId: 'dev' },
    {
      id: 'staging',
      name: 'Staging',
      branchPattern: 'staging',
      sourceStageId: 'test',
    },
    {
      id: 'preview',
      name: 'Previews',
      branchPattern: 'preview/*',
      sourceStageId: 'dev',
    },
    {
      id: 'release',
      name: 'Release',
      branchPattern: 'release/*',
      sourceStageId: 'prod',
    },
    {
      id: 'prod',
      name: 'Prod',
      branchPattern: 'main',
      sourceStageId: 'staging',
    },
  ],
  rowDividers: [
    { beforeId: 'billing', style: 'thick', label: 'Commerce' },
    { beforeId: 'catalog', style: 'thick', label: 'Discovery & data' },
    { beforeId: 'legacy-billing', style: 'dashed', label: 'Needs attention' },
    { beforeId: 'marketing-site', style: 'double', label: 'Amplify sites' },
  ],
  columnDividers: [{ beforeId: 'preview', style: 'dashed' }],
  credentials: [
    { id: DEMO_GITHUB_CREDENTIAL, kind: 'github', label: 'Demo GitHub' },
    { id: DEMO_AWS_CREDENTIAL, kind: 'aws', label: 'Demo AWS' },
  ],
});

/** The demo stage ids, in column order. */
export const DEMO_STAGE_IDS = demoDashboard.stages.map((s) => s.id);
