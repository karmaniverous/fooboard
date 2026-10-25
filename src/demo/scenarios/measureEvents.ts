/**
 * The measurement scenario's cells (spec.md §3.14 *Measurement
 * scenario*): C-23's per-cell states as pinned events, after each repo's
 * pinned history: two behind and one diverged, runs started, queued,
 * partial, failed and cancelled, three runs unmapped on purpose, a newer
 * run 2.5 minutes in whose jobs answer slowly, and two Amplify jobs.
 *
 * @module
 */
import { acmeRepo, at, commits, HOUR, MINUTE, SECOND } from './pipeline';

/** Stage branches the measurement board reads. */
export const PREVIEWS = ['preview/bali', 'preview/spokane', 'preview/texas'];
export const RELEASE = 'release/24.3';

/** A pinned run of Deploy on `branch` of `name`. */
const run = (
  name: string,
  branch: string,
  minutes: number,
  extra: Record<string, unknown> = {},
) => ({
  kind: 'run' as const,
  repo: acmeRepo(name),
  branch,
  workflow: 'Deploy',
  at: at(minutes),
  ...extra,
});

/** Start now and run for a while (C-23's *started*). */
const started = { queueMs: 0, durationsMs: [150 * SECOND, 60 * SECOND] };
/** Deploy done, tests queued for an hour (C-23's *partial*). */
const partial = {
  queueMs: 0,
  durationsMs: [2 * MINUTE, 3 * MINUTE],
  gapMs: HOUR,
};

/** Promote dev to `to` (and release to main) in `name`, at `minutes`. */
const promote = (
  name: string,
  to: string[],
  minutes: number,
  toMain = true,
) => [
  ...to.map((b) => ({
    kind: 'promote' as const,
    repo: acmeRepo(name),
    from: 'dev',
    to: b,
    at: at(minutes),
  })),
  ...(toMain
    ? [
        {
          kind: 'promote' as const,
          repo: acmeRepo(name),
          from: RELEASE,
          to: 'main',
          at: at(minutes + 5),
        },
      ]
    : []),
];

export const measureCells = [
  // billing's bali misses three dev commits; shipping's prod three release ones.
  ...commits(acmeRepo('billing'), 'dev', at(-90), 3),
  ...promote('billing', ['preview/spokane', 'preview/texas', RELEASE], -80),
  ...commits(acmeRepo('shipping'), 'dev', at(-90), 3),
  ...promote('shipping', [...PREVIEWS, RELEASE], -80, false),
  // orders' spokane has a hotfix of its own, and misses four dev commits.
  ...commits(acmeRepo('orders'), 'dev', at(-90), 4),
  ...promote('orders', ['preview/bali', 'preview/texas', RELEASE], -80),
  ...commits(acmeRepo('orders'), 'preview/spokane', at(-70), 2),
  run('api-core', 'preview/spokane', -1, started),
  run('analytics', 'preview/bali', -1, started),
  run('web-app', 'preview/bali', -10, partial),
  run('notifications', 'preview/spokane', -10, partial),
  run('web-app', 'preview/texas', -0.5, { queueMs: MINUTE }),
  run('mobile-bff', 'main', -20, { outcome: 'failure', job: 1 }),
  run('catalog', RELEASE, -25, { outcome: 'failure', job: 1 }),
  run('payments', 'dev', -15, { outcome: 'cancelled', job: 0 }),
  // Unmapped on purpose: a hotfix branch, a lint-only run, another service's deploy.
  {
    kind: 'commit' as const,
    repo: acmeRepo('api-core'),
    branch: 'hotfix/login',
    at: at(-5),
  },
  {
    kind: 'run' as const,
    repo: acmeRepo('web-app'),
    branch: 'dev',
    workflow: 'Lint',
    at: at(-2),
  },
  {
    kind: 'run' as const,
    repo: acmeRepo('payments'),
    branch: 'dev',
    workflow: 'Deploy refunds',
    at: at(-3),
  },
  // A newer run after the board has loaded, whose jobs answer slowly.
  run('web-app', 'main', 2.5, {
    queueMs: 0,
    durationsMs: [MINUTE, 10 * SECOND],
    gapMs: 0,
    slowJobsMs: 5 * SECOND,
  }),
  {
    kind: 'appJob' as const,
    appId: 'd1demomarketing',
    branch: 'preview/spokane',
    at: at(-1),
    queueMs: 0,
    durationMs: 150 * SECOND,
  },
  {
    kind: 'appJob' as const,
    appId: 'd1demomarketing',
    branch: 'main',
    at: at(-20),
    outcome: 'failure' as const,
  },
];
