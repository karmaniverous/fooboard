/**
 * The demo scenario's pinned events (spec.md §3.14 *Coverage*): what Acme
 * shows at fixed times, so every status of each preset, *Unknown*, both
 * badges (one appearing and clearing), a slow run after load, an error,
 * a missing credential, *No app*, *no records* and two unmapped runs fall
 * within `DEMO_COVERAGE_WINDOW_MS` whatever the seeded cadences do.
 *
 * @module
 */
import { ACME_BRANCHES as B, ACME_INFRA } from './acmeBoard';
import { acmeRepo, at, MINUTE, promoted } from './pipeline';

/** A pinned run of `workflow` on `branch` of `name`. */
const run = (
  name: string,
  branch: string,
  minutes: number,
  extra: Record<string, unknown> = {},
  wf = 'Deploy',
) => ({
  kind: 'run' as const,
  repo: acmeRepo(name),
  branch,
  workflow: wf,
  at: at(minutes),
  ...extra,
});
const appJob = (
  appId: string,
  branch: string,
  minutes: number,
  extra: Record<string, unknown> = {},
) => ({
  kind: 'appJob' as const,
  appId,
  branch,
  at: at(minutes),
  ...extra,
});
const promote = (name: string, from: string, to: string, minutes: number) => ({
  kind: 'promote' as const,
  repo: acmeRepo(name),
  from,
  to,
  at: at(minutes),
});
/** Ended a moment before the opening: jobs of 30–50 s, back to back. */
const quick = { queueMs: 0, durationsMs: [30_000, 50_000], gapMs: 0 };
const steps: [string, string, number][] = [
  [B.dev, B.alpha, 5],
  [B.dev, B.beta, 10],
  [B.dev, B.staging, 20],
  [B.staging, B.prod, 40],
];

export const acmePinned = [
  // Repos without a dev cadence still have a history.
  ...['catalog', ACME_INFRA, 'docs'].flatMap((name) =>
    promoted(acmeRepo(name), at(-150), B.dev, steps),
  ),
  // GitHub deploy and test: every status at load.
  run(
    'api-gateway',
    B.alpha,
    -1,
    { queueMs: 0, durationsMs: [3 * MINUTE] },
    'Preview',
  ),
  run('accounts', B.staging, -4, {
    queueMs: 0,
    durationsMs: [2 * MINUTE, 6 * MINUTE],
    gapMs: 0,
  }),
  run('catalog', B.dev, -6, {
    queueMs: 0,
    durationsMs: [2 * MINUTE, 3 * MINUTE],
    gapMs: 20 * MINUTE,
  }),
  run('cart', B.beta, -0.5, { queueMs: 3 * MINUTE }, 'Preview'),
  run('cart', B.staging, -2, { outcome: 'failure', job: 1, ...quick }),
  run(
    'checkout',
    B.alpha,
    -2,
    { outcome: 'failure', job: 0, ...quick },
    'Preview',
  ),
  run(
    'payments',
    B.beta,
    -2,
    { outcome: 'cancelled', job: 0, ...quick },
    'Preview',
  ),
  // catalog takes no dev commits, so nothing replaces this one soon.
  run(
    'catalog',
    B.alpha,
    -0.9,
    { outcome: 'cancelled', job: 0, ...quick },
    'Preview',
  ),
  // GitHub single job (notifications): every status at load.
  run('notifications', B.alpha, -2, { outcome: 'failure', ...quick }),
  run('notifications', B.dev, -0.3, { queueMs: 2 * MINUTE }),
  run('notifications', B.staging, -1, {
    queueMs: 0,
    durationsMs: [3 * MINUTE],
  }),
  run('notifications', B.prod, -0.9, { outcome: 'cancelled', ...quick }),
  // payments' staging has a hotfix dev lacks (diverged).
  {
    kind: 'commit' as const,
    repo: acmeRepo('payments'),
    branch: B.staging,
    at: at(-50),
    message: 'Hotfix: refund rounding',
  },
  // catalog: staging falls behind dev, then catches up; prod follows.
  promote('catalog', B.dev, B.staging, -2),
  {
    kind: 'commit' as const,
    repo: acmeRepo('catalog'),
    branch: B.dev,
    at: at(1),
    message: 'Show stock levels',
  },
  promote('catalog', B.dev, B.staging, 6),
  promote('catalog', B.staging, B.prod, 8),
  // A run after load whose jobs answer slowly (the refreshing dot).
  run('accounts', B.prod, 2, {
    queueMs: 0,
    durationsMs: [MINUTE, MINUTE],
    gapMs: 0,
    slowJobsMs: 5000,
  }),
  // infra's Terraform set: applying, failed, and Unknown (queued, cancelled).
  run(ACME_INFRA, B.beta, -0.5, { queueMs: 3 * MINUTE }, 'Terraform'),
  run(
    ACME_INFRA,
    B.dev,
    -1,
    { queueMs: 0, durationsMs: [4 * MINUTE] },
    'Terraform',
  ),
  run(ACME_INFRA, B.prod, -2, { outcome: 'failure', ...quick }, 'Terraform'),
  run(
    ACME_INFRA,
    B.alpha,
    3,
    { outcome: 'cancelled', queueMs: 0, durationsMs: [2 * MINUTE] },
    'Terraform',
  ),
  // Amplify: running, queued, failed and cancelled.
  appJob('d2acmestorefront', B.alpha, -1, {
    queueMs: 0,
    durationMs: 4 * MINUTE,
  }),
  appJob('d2acmeadmin', B.beta, -0.5, { queueMs: 2 * MINUTE }),
  appJob('d2acmemarketing', B.staging, -2, {
    outcome: 'failure',
    queueMs: 0,
    durationMs: MINUTE,
  }),
  appJob('d2acmemarketing', B.beta, -0.9, {
    outcome: 'cancelled',
    queueMs: 0,
    durationMs: MINUTE,
  }),
  // Unmapped on purpose: a hotfix branch's deploy, a lint-only run.
  {
    kind: 'commit' as const,
    repo: acmeRepo('api-gateway'),
    branch: 'hotfix/checkout-timeout',
    at: at(-8),
  },
  run('accounts', B.dev, -3, {}, 'Lint'),
];
