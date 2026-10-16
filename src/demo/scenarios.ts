/**
 * What each demo cell shows (spec.md C-23): a scenario per row and stage,
 * chosen so every status, both badges and every empty state appear on the
 * board, plus how each scenario's jobs evolve over time so the demo board
 * moves. Pure data and functions of elapsed time; the demo providers turn
 * them into provider-shaped payloads.
 *
 * @module
 */

/** One minute, for demo timelines. */
export const MINUTE = 60_000;

/** What one demo cell is set up to show. */
export type DemoScenario =
  | 'success'
  | 'partial'
  | 'started'
  | 'queued'
  | 'failure'
  | 'cancelled'
  | 'behind'
  | 'diverged'
  | 'noBranch'
  | 'noRuns';

/** Cells that aren't plain success, keyed `row:stage`. */
const OVERRIDES: Record<string, DemoScenario> = {
  'api-core:staging': 'started',
  'web-app:test': 'partial',
  'web-app:preview': 'queued',
  'mobile-bff:prod': 'failure',
  'auth-service:release': 'noBranch',
  'billing:test': 'behind',
  'orders:staging': 'diverged',
  'payments:dev': 'cancelled',
  'inventory:preview': 'noRuns',
  'shipping:prod': 'behind',
  'catalog:release': 'failure',
  'search:preview': 'noBranch',
  'notifications:staging': 'partial',
  'analytics:test': 'started',
  'admin-portal:preview': 'noBranch',
  'docs-site:release': 'noBranch',
  'marketing-site:staging': 'started',
  'marketing-site:prod': 'failure',
  'partner-portal:preview': 'noBranch',
};

/** The scenario for one cell. */
export function scenarioFor(rowId: string, stageId: string): DemoScenario {
  return OVERRIDES[`${rowId}:${stageId}`] ?? 'success';
}

/** The concrete branch each demo stage's pattern matches. */
const STAGE_BRANCH: Record<string, string> = {
  dev: 'dev',
  test: 'test',
  staging: 'staging',
  preview: 'preview/bali',
  release: 'release/24.3',
  prod: 'main',
};

/** The demo branch for a stage id (every demo stage has exactly one). */
export function stageBranch(stageId: string): string {
  return STAGE_BRANCH[stageId] ?? stageId;
}

/** The stage a demo branch belongs to, if any. */
export function stageForBranch(branch: string): string | undefined {
  return Object.keys(STAGE_BRANCH).find((id) => STAGE_BRANCH[id] === branch);
}

/** A job's state at one moment, in provider-neutral terms. */
export type DemoJobState =
  'waiting' | 'queued' | 'running' | 'success' | 'failure' | 'cancelled';

/** Deploy and test job states for a scenario, `elapsedMs` after demo start.
 * Started runs finish after 90 s; queued runs start after 30 s and finish
 * after 2 min, so the board visibly progresses. */
export function jobStates(
  scenario: DemoScenario,
  elapsedMs: number,
): { deploy: DemoJobState; test: DemoJobState } {
  switch (scenario) {
    case 'started':
      return elapsedMs < 90_000
        ? { deploy: 'running', test: 'queued' }
        : { deploy: 'success', test: 'success' };
    case 'queued':
      if (elapsedMs < 30_000) return { deploy: 'waiting', test: 'queued' };
      return elapsedMs < 120_000
        ? { deploy: 'running', test: 'queued' }
        : { deploy: 'success', test: 'success' };
    case 'partial':
      return { deploy: 'success', test: 'queued' };
    case 'failure':
      return { deploy: 'success', test: 'failure' };
    case 'cancelled':
      return { deploy: 'cancelled', test: 'cancelled' };
    default:
      return { deploy: 'success', test: 'success' };
  }
}

/** How far a cell's branch is from its source stage's branch: commits the
 * source has that the cell lacks (`behind`) and the reverse (`ahead`). */
export function stalenessCounts(scenario: DemoScenario): {
  behind: number;
  ahead: number;
} {
  if (scenario === 'behind') return { behind: 3, ahead: 0 };
  if (scenario === 'diverged') return { behind: 4, ahead: 2 };
  return { behind: 0, ahead: 0 };
}
