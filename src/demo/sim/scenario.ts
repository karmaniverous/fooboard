/**
 * The simulated world as data (spec.md §3.14 *Scenario*, Decision 53
 * item 7): GitHub tokens and repos (branches, workflows and their jobs
 * with durations and outcome patterns), AWS keys and Amplify apps by
 * account and region, the promotions that move commits dev → release →
 * prod, pinned events that guarantee what the demo must show, and the
 * demo dashboard (data model v6) that reads part of it. One module per
 * scenario under `src/demo/scenarios/`, validated by `parseScenario`.
 * The engine reads only this shape, so adding a repo or an app, with its
 * row, needs no engine change.
 *
 * @module
 */
import { z } from 'zod';

import { DashboardSchema } from '@/domain/config/dashboard';

/** A time range in ms, `[min, max]`; the engine draws within it. */
const RangeSchema = z
  .tuple([z.number().nonnegative(), z.number().nonnegative()])
  .refine(([min, max]) => min <= max, 'min must not exceed max');

/** How often a run or a job ends other than in success: the chance of a
 * failure and of a cancel, the rest succeeding. */
const OutcomePatternSchema = z.object({
  failure: z.number().min(0).max(1).default(0),
  cancelled: z.number().min(0).max(1).default(0),
});

/** A run's outcome, as GitHub concludes the job it falls on. */
const RunOutcomeSchema = z.enum(['success', 'failure', 'cancelled']);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

/** An Amplify job's outcome. */
const JobOutcomeSchema = z.enum(['success', 'failure', 'cancelled']);
export type JobOutcome = z.infer<typeof JobOutcomeSchema>;

/** Default wait from a push to a run's first job, and between its jobs. */
const DEFAULT_QUEUE_MS: [number, number] = [5_000, 25_000];
const DEFAULT_GAP_MS: [number, number] = [10_000, 40_000];

const WorkflowSchema = z.object({
  name: z.string().min(1),
  /** File under `.github/workflows/`; derived from the name if absent. */
  path: z.string().optional(),
  /** Branch globs whose pushes trigger it (`*`, `**` as stage rules). */
  on: z.array(z.string().min(1)).min(1),
  jobs: z
    .array(z.object({ name: z.string().min(1), durationMs: RangeSchema }))
    .min(1),
  outcomes: OutcomePatternSchema.default({ failure: 0, cancelled: 0 }),
  queueMs: RangeSchema.default(DEFAULT_QUEUE_MS),
  gapMs: RangeSchema.default(DEFAULT_GAP_MS),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

const RepoSchema = z.object({
  /** `owner/name`. */
  fullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  private: z.boolean().default(true),
  branches: z
    .array(
      z.object({
        name: z.string().min(1),
        /** Where new commits land, and how often (dev, feature work). */
        commitsEveryMs: RangeSchema.optional(),
      }),
    )
    .min(1),
  workflows: z.array(WorkflowSchema).default([]),
  /** `serverError`: every read of the repo answers 500. */
  fault: z.literal('serverError').optional(),
});
export type Repo = z.infer<typeof RepoSchema>;

const AppSchema = z.object({
  account: z.string().min(1),
  region: z.string().min(1),
  appId: z.string().min(1),
  name: z.string().min(1),
  /** A GitHub URL; a scenario repo's pushes to a branch start its jobs. */
  repository: z.string().optional(),
  branches: z.array(
    z.object({
      name: z.string().min(1),
      durationMs: RangeSchema,
      outcomes: OutcomePatternSchema.default({ failure: 0, cancelled: 0 }),
      /** Builds of its own, for an app whose repo isn't simulated. */
      everyMs: RangeSchema.optional(),
      queueMs: RangeSchema.default(DEFAULT_QUEUE_MS),
    }),
  ),
});
export type App = z.infer<typeof AppSchema>;

const at = z.number();

/** Events at fixed times (ms from the demo's opening; negative is
 * history), so coverage never rests on chance. */
const PinnedEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('commit'),
    repo: z.string(),
    branch: z.string(),
    at,
    message: z.string().optional(),
  }),
  z.object({
    kind: z.literal('promote'),
    repo: z.string(),
    from: z.string(),
    to: z.string(),
    at,
  }),
  z.object({
    kind: z.literal('run'),
    repo: z.string(),
    branch: z.string(),
    workflow: z.string(),
    at,
    outcome: RunOutcomeSchema.default('success'),
    /** The job the outcome falls on (default: the last). */
    job: z.number().int().nonnegative().optional(),
    queueMs: z.number().nonnegative().optional(),
    durationsMs: z.array(z.number().nonnegative()).optional(),
    gapMs: z.number().nonnegative().optional(),
    /** Its jobs answer this much later (the refreshing dot, Decision 47). */
    slowJobsMs: z.number().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('appJob'),
    appId: z.string(),
    branch: z.string(),
    at,
    outcome: JobOutcomeSchema.default('success'),
    queueMs: z.number().nonnegative().optional(),
    durationMs: z.number().nonnegative().optional(),
  }),
]);
export type PinnedEvent = z.infer<typeof PinnedEventSchema>;

export const DemoScenarioSchema = z.object({
  seed: z.number().int(),
  /** How long before the opening the world's history starts. */
  historyMs: z.number().positive(),
  github: z.object({
    tokens: z.array(
      z.object({
        id: z.string().min(1),
        secret: z.string().min(1),
        /** The repos (`owner/name`) the token can see. */
        repos: z.array(z.string()),
        rejected: z.boolean().default(false),
      }),
    ),
    repos: z.array(RepoSchema),
  }),
  aws: z.object({
    keys: z.array(
      z.object({
        id: z.string().min(1),
        accessKeyId: z.string().min(1),
        secret: z.string().min(1),
        account: z.string().min(1),
      }),
    ),
    apps: z.array(AppSchema),
  }),
  promotions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      everyMs: z.number().positive(),
    }),
  ),
  pinned: z.array(PinnedEventSchema),
  dashboard: DashboardSchema,
});
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;
export type DemoScenarioInput = z.input<typeof DemoScenarioSchema>;

/** Every name a pinned event uses that the scenario doesn't define. */
function danglingReferences(s: DemoScenario): string[] {
  const repos = new Map(s.github.repos.map((r) => [r.fullName, r]));
  const apps = new Map(s.aws.apps.map((a) => [a.appId, a]));
  const branchOf = (repo: string, branch: string) =>
    repos.get(repo)?.branches.some((b) => b.name === branch) === true;
  const missing: string[] = [];
  for (const e of s.pinned) {
    if (e.kind === 'appJob') {
      if (!apps.get(e.appId)?.branches.some((b) => b.name === e.branch))
        missing.push(`app branch ${e.appId}/${e.branch}`);
      continue;
    }
    const names = e.kind === 'promote' ? [e.from, e.to] : [e.branch];
    for (const name of names)
      if (!branchOf(e.repo, name)) missing.push(`branch ${e.repo}:${name}`);
    if (
      e.kind === 'run' &&
      !repos.get(e.repo)?.workflows.some((w) => w.name === e.workflow)
    )
      missing.push(`workflow ${e.repo}:${e.workflow}`);
  }
  return missing;
}

/** Validate a scenario (its schema, then that every pinned event names
 * a repo, branch, workflow or app it defines). */
export function parseScenario(input: DemoScenarioInput): DemoScenario {
  const scenario = DemoScenarioSchema.parse(input);
  const missing = danglingReferences(scenario);
  if (missing.length > 0)
    throw new Error(`Scenario refers to undefined ${missing.join(', ')}`);
  return scenario;
}
