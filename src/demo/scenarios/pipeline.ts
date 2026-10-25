/**
 * Scenario building blocks (spec.md §3.14 *Scenario*): time units, a
 * workflow of jobs run one after another, and a repo's history written
 * as pinned events (a commit on dev, then promotions down its stages),
 * so a scenario states what each repo went through without the engine
 * knowing anything about it. Pure data helpers.
 *
 * @module
 */
import type { DemoScenarioInput } from '@/demo/sim/scenario';

/** Time units for scenario data. */
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

/** `minutes` from the demo's opening, in ms (negative: history). */
export const at = (minutes: number): number => minutes * MINUTE;

/** A repo of Acme's, the company both scenarios simulate. */
export const acmeRepo = (name: string): string => `acme/${name}`;

type ScenarioInput = DemoScenarioInput;
type RepoInput = ScenarioInput['github']['repos'][number];
type WorkflowInput = NonNullable<RepoInput['workflows']>[number];
type PinnedInput = ScenarioInput['pinned'][number];

/** A workflow running `jobs` (name and duration range, in minutes) one
 * after another on pushes to `on`. */
export function workflow(
  name: string,
  on: string[],
  jobs: [name: string, minutes: [number, number]][],
  extra: Partial<WorkflowInput> = {},
): WorkflowInput {
  return {
    name,
    on,
    jobs: jobs.map(([job, [min, max]]) => ({
      name: job,
      durationMs: [min * MINUTE, max * MINUTE],
    })),
    ...extra,
  };
}

/** One promotion step: `from` → `to`, `minutes` after the commit. */
export type Step = [from: string, to: string, minutes: number];

/** A repo's history as pinned events: a commit on `source` at `at`
 * (ms), then each step's promotion. */
export function promoted(
  repo: string,
  at: number,
  source: string,
  steps: readonly Step[],
): PinnedInput[] {
  return [
    { kind: 'commit', repo, branch: source, at },
    ...steps.map(([from, to, minutes]): PinnedInput => ({
      kind: 'promote',
      repo,
      from,
      to,
      at: at + minutes * MINUTE,
    })),
  ];
}

/** `count` commits on `branch` a minute apart, from `at`. */
export const commits = (
  repo: string,
  branch: string,
  at: number,
  count: number,
): PinnedInput[] =>
  Array.from({ length: count }, (_, i) => ({
    kind: 'commit',
    repo,
    branch,
    at: at + i * MINUTE,
  }));
