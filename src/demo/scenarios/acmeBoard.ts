/**
 * The demo's dashboard (spec.md §3.14 *Board shape and size*, Decision
 * 54): Acme's platform as a team would set it up. A *Preview* column
 * group (Alpha, Beta) then Dev, Staging and Prod; a *Frontend* row group
 * of Amplify apps found by repo, a *Services* row group of GitHub repos,
 * and an ungrouped *infra* row read with the single-job preset. It uses
 * the unified settings: the dashboard's GitHub token and dev AWS key, the
 * Prod column's own AWS key (Acme's production account), and one cell
 * override (the docs site's Prod deploys from the marketing account,
 * whose key nobody has entered: *Needs credential*). *notifications*
 * deploys with one job (the single-job preset); *infra* uses a custom
 * set, *Terraform*, that names only failed, applying and applied, so a
 * queued or cancelled apply shows *Unknown*.
 *
 * @module
 */
import { DEMO_DASHBOARD_ID } from '@/demo/constants';
import type { DemoScenarioInput } from '@/demo/sim/scenario';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { presetById } from '@/domain/statuses/presets';

/** The demo's credentials. */
export const ACME_GITHUB = 'acme-github';
export const ACME_DEV_AWS = 'acme-dev-aws';
export const ACME_PROD_AWS = 'acme-prod-aws';
/** Listed, never entered: the docs Prod cell's (*Needs credential*). */
export const ACME_MARKETING_AWS = 'acme-marketing-aws';

/** Amplify apps, found by repo (the *Frontend* row group). */
export const ACME_FRONTEND = [
  'storefront',
  'mobile-web',
  'admin-console',
  'marketing-site',
  'help-center',
  'docs',
] as const;
/** GitHub repos (the *Services* row group). */
export const ACME_SERVICES = [
  'api-gateway',
  'accounts',
  'catalog',
  'cart',
  'checkout',
  'payments',
  'orders',
  'inventory',
  'shipping',
  'reviews',
  'search',
  'webhooks',
  'notifications',
] as const;
/** The ungrouped rows: database migrations, and infrastructure (one
 * Terraform job per run). */
export const ACME_MIGRATIONS = 'migrations';
export const ACME_INFRA = 'infra';

/** Branches a column reads. */
export const ACME_BRANCHES = {
  alpha: 'preview/alpha',
  beta: 'preview/beta',
  dev: 'dev',
  staging: 'release',
  prod: 'main',
} as const;

const frontend = ACME_FRONTEND.map((name) => ({
  type: 'amplify' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  ...(name === 'docs'
    ? { cellSettings: { prod: { awsKey: ACME_MARKETING_AWS } } }
    : {}),
}));

const github = (name: string, extra: object = {}) => ({
  type: 'github' as const,
  id: name,
  repo: `acme/${name}`,
  displayName: name,
  ...extra,
});

const singleJob = {
  settings: { statusSets: { github: PRESET_IDS.githubSingleJob } },
};
const services = ACME_SERVICES.map((name) =>
  github(name, name === 'notifications' ? singleJob : {}),
);

/** *infra*'s status set: the single-job preset's failed, running and
 * succeeded, renamed for Terraform; nothing else. */
const TERRAFORM_SET_ID = 'terraform';
const NAMES: Partial<Record<string, string>> = {
  failed: 'Failed',
  running: 'Applying',
  succeeded: 'Applied',
};
const singleJobSet = presetById(PRESET_IDS.githubSingleJob);
const terraformSet = {
  ...singleJobSet,
  id: TERRAFORM_SET_ID,
  name: 'Terraform',
  cell: singleJobSet.cell.flatMap((s) => {
    const name = NAMES[s.id];
    return name ? [{ ...s, name }] : [];
  }),
};
const infra = github(ACME_INFRA, {
  settings: { statusSets: { github: TERRAFORM_SET_ID } },
});

const preview = (id: 'alpha' | 'beta', name: string) => ({
  id,
  name,
  rules: branchRules(ACME_BRANCHES[id]),
  sourceStageId: 'dev',
});

export const acmeDashboard: DemoScenarioInput['dashboard'] = {
  id: DEMO_DASHBOARD_ID,
  name: 'Acme platform (demo)',
  rows: [...frontend, ...services, github(ACME_MIGRATIONS), infra],
  stages: [
    preview('alpha', 'Alpha'),
    preview('beta', 'Beta'),
    { id: 'dev', name: 'Dev', rules: branchRules(ACME_BRANCHES.dev) },
    {
      id: 'staging',
      name: 'Staging',
      rules: branchRules(ACME_BRANCHES.staging),
      sourceStageId: 'dev',
    },
    {
      id: 'prod',
      name: 'Prod',
      rules: branchRules(ACME_BRANCHES.prod),
      sourceStageId: 'staging',
      settings: { awsKey: ACME_PROD_AWS },
    },
  ],
  rowGroups: [
    { id: 'frontend', label: 'Frontend', memberIds: frontend.map((r) => r.id) },
    { id: 'services', label: 'Services', memberIds: services.map((r) => r.id) },
  ],
  columnGroups: [
    { id: 'preview', label: 'Preview', memberIds: ['alpha', 'beta'] },
  ],
  credentials: [
    { id: ACME_GITHUB, kind: 'github', label: 'Acme GitHub' },
    { id: ACME_DEV_AWS, kind: 'aws', label: 'Acme dev AWS' },
    { id: ACME_PROD_AWS, kind: 'aws', label: 'Acme prod AWS' },
    { id: ACME_MARKETING_AWS, kind: 'aws', label: 'Acme marketing AWS' },
  ],
  customStatusSets: [terraformSet],
  settings: { githubToken: ACME_GITHUB, awsKey: ACME_DEV_AWS },
};
