/**
 * The shipped demo scenario (spec.md §3.14, Decisions 53 and 54): Acme's
 * platform. Commits land on each service's dev every few minutes and are
 * promoted on schedules to the previews, staging and prod, so new runs
 * keep arriving and badges come and go. Pinned events guarantee, within
 * `DEMO_COVERAGE_WINDOW_MS`, every status of each preset and *Unknown*,
 * behind and diverged badges (one appearing and clearing), a run after
 * load whose jobs answer slowly (the refreshing dot), an error, a missing
 * credential, *No app*, *no records* and two runs left unmapped on
 * purpose. The account also holds repos, branches and an app the board
 * doesn't show, for the editors' pickers.
 *
 * @module
 */
import { DEMO_SEED } from '@/demo/constants';
import { parseScenario } from '@/demo/sim/scenario';

import {
  ACME_BRANCHES as B,
  ACME_DEV_AWS,
  ACME_GITHUB,
  ACME_INFRA,
  ACME_MIGRATIONS,
  ACME_PROD_AWS,
  ACME_SERVICES,
  acmeDashboard,
} from './acmeBoard';
import { acmePinned } from './acmeEvents';
import { acmeRepo, HOUR, MINUTE, workflow } from './pipeline';

const STAGES = [B.alpha, B.beta, B.dev, B.staging, B.prod];
const DEPLOY_ON = [B.dev, B.staging, B.prod, 'hotfix/*'];
const DEV_CADENCE: [number, number] = [20 * MINUTE, 40 * MINUTE];
const OUTCOMES = { failure: 0.06, cancelled: 0.02 };

/** A repo: its stage branches (dev taking commits at `cadence`) and more. */
function repo(
  name: string,
  workflows: ReturnType<typeof workflow>[],
  opts: {
    cadence?: boolean;
    skip?: string[];
    extra?: string[];
    quiet?: string[];
  } = {},
) {
  return {
    fullName: acmeRepo(name),
    branches: [
      ...STAGES.filter((b) => !(opts.skip ?? []).includes(b)).map((b) => ({
        name: b,
        ...(b === B.dev && opts.cadence !== false
          ? { commitsEveryMs: DEV_CADENCE }
          : {}),
      })),
      ...(opts.extra ?? []).map((b) => ({
        name: b,
        commitsEveryMs: [20 * MINUTE, 40 * MINUTE] as [number, number],
      })),
      ...(opts.quiet ?? []).map((b) => ({ name: b })),
    ],
    workflows,
  };
}

const deploy = workflow(
  'Deploy',
  DEPLOY_ON,
  [
    ['deploy', [2, 4]],
    ['test', [2, 5]],
  ],
  { outcomes: OUTCOMES },
);
/** Previews deploy without tests (deploy and test's *Deployed*). */
const preview = workflow('Preview', ['preview/*'], [['deploy', [2, 3]]], {
  outcomes: OUTCOMES,
});
const lint = workflow('Lint', ['ci/*'], [['lint', [1, 1]]]);

const services = ACME_SERVICES.map((name) => {
  if (name === 'notifications')
    return repo(
      name,
      [
        workflow('Deploy', [...DEPLOY_ON, 'preview/*'], [['deploy', [1, 3]]], {
          outcomes: OUTCOMES,
        }),
      ],
      { skip: [B.beta] },
    );
  if (name === 'search')
    return { ...repo(name, [deploy, preview]), fault: 'serverError' as const };
  return repo(
    name,
    name === 'accounts' ? [deploy, preview, lint] : [deploy, preview],
    {
      cadence: name !== 'catalog',
      extra: name === 'checkout' ? ['feature/new-checkout'] : [],
      quiet: name === 'api-gateway' ? ['hotfix/checkout-timeout'] : [],
    },
  );
});
const migrations = repo(ACME_MIGRATIONS, [deploy, preview]);
const infra = repo(
  ACME_INFRA,
  [workflow('Terraform', STAGES, [['apply', [1, 3]]])],
  { cadence: false },
);
const frontend = [
  repo('storefront', [], { extra: ['feature/dark-mode'] }),
  repo('mobile-web', []),
  repo('admin-console', []),
  repo('marketing-site', []),
  repo('help-center', []),
  repo('docs', [], { cadence: false }),
];
const extras = ['design-system', 'data-pipeline', 'sandbox'].map((name) => ({
  fullName: acmeRepo(name),
  branches: [
    { name: B.prod },
    {
      name: B.dev,
      commitsEveryMs: [30 * MINUTE, 60 * MINUTE] as [number, number],
    },
  ],
}));

const DEV_ACCOUNT = '210987654321';
const PROD_ACCOUNT = '123456789012';
const appBranches = (names: string[]) =>
  names.map((name) => ({
    name,
    durationMs: [3 * MINUTE, 5 * MINUTE] as [number, number],
    outcomes: { failure: 0.05, cancelled: 0 },
  }));
const PRE_PROD = [B.alpha, B.beta, B.dev, B.staging];
const app = (
  account: string,
  region: string,
  appId: string,
  name: string,
  branches: string[],
) => ({
  account,
  region,
  appId,
  name,
  repository: `https://github.com/acme/${name}`,
  branches: appBranches(branches),
});

export const acmeScenario = parseScenario({
  seed: DEMO_SEED,
  historyMs: 3 * HOUR,
  github: {
    tokens: [
      {
        id: ACME_GITHUB,
        secret: 'demo-token-acme',
        repos: [...services, migrations, infra, ...frontend, ...extras].map(
          (r) => r.fullName,
        ),
      },
    ],
    repos: [...frontend, ...services, migrations, infra, ...extras],
  },
  aws: {
    keys: [
      {
        id: ACME_DEV_AWS,
        accessKeyId: 'DEMOACMEDEVKEY01',
        secret: 'demo-secret-dev',
        account: DEV_ACCOUNT,
      },
      {
        id: ACME_PROD_AWS,
        accessKeyId: 'DEMOACMEPRODKEY1',
        secret: 'demo-secret-prod',
        account: PROD_ACCOUNT,
      },
    ],
    apps: [
      app(DEV_ACCOUNT, 'us-east-1', 'd2acmestorefront', 'storefront', PRE_PROD),
      app(DEV_ACCOUNT, 'us-west-2', 'd2acmemobile', 'mobile-web', PRE_PROD),
      app(DEV_ACCOUNT, 'us-west-2', 'd2acmeadmin', 'admin-console', PRE_PROD),
      app(DEV_ACCOUNT, 'us-east-1', 'd2acmehelp', 'help-center', PRE_PROD),
      app(
        DEV_ACCOUNT,
        'us-east-1',
        'd2acmemarketing',
        'marketing-site',
        PRE_PROD,
      ),
      app(DEV_ACCOUNT, 'us-east-1', 'd2acmedocs', 'docs', PRE_PROD),
      app(DEV_ACCOUNT, 'us-east-1', 'd2acmesandbox', 'sandbox', [B.prod]),
      app(PROD_ACCOUNT, 'us-east-1', 'd3acmestorefront', 'storefront', [
        B.prod,
      ]),
      app(PROD_ACCOUNT, 'us-east-1', 'd3acmemarketing', 'marketing-site', [
        B.prod,
      ]),
      app(PROD_ACCOUNT, 'us-east-1', 'd3acmemobile', 'mobile-web', [B.prod]),
      app(PROD_ACCOUNT, 'us-east-1', 'd3acmehelp', 'help-center', [B.prod]),
    ],
  },
  promotions: [
    { from: B.dev, to: B.alpha, everyMs: 15 * MINUTE },
    { from: B.dev, to: B.beta, everyMs: 20 * MINUTE },
    { from: B.dev, to: B.staging, everyMs: 25 * MINUTE },
    { from: B.staging, to: B.prod, everyMs: 50 * MINUTE },
  ],
  pinned: acmePinned,
  dashboard: acmeDashboard,
});
