/**
 * One row of the board from the cache (spec.md §3.1): its provider's
 * derivation, then staleness through its git link, each cell reading with
 * the credentials it resolves to (spec.md §3.11), giving the row's
 * board cells, the queries it needs and the groups (a token's repo, an
 * Amplify app) whose Unmapped runs and problems it feeds. Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import { cellRulesFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, GithubRow, Row } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { sourceRuleFor } from '@/domain/model/sources';
import { cellCredentials, credentialName } from '@/domain/settings/credentials';
import { resolveSetting } from '@/domain/settings/resolve';
import { appKey } from '@/lib/amplify/rowJobs';
import { isOverPollingShare } from '@/lib/github';
import type { BudgetStore } from '@/query/budgets';
import type { QueryProviders } from '@/query/fetchers';

import { rowApps } from './amplifyAccess';
import { type AmplifyContext, deriveAmplifyRow } from './amplifyRow';
import { type AppSearch, appSearch } from './appSearch';
import { emptyViews } from './cells';
import { mergeDerivations, segments } from './cellSegments';
import { deriveGithubRow, type GithubContext } from './githubRow';
import type { Need, RowDerivation } from './need';
import type { RefreshClock } from './refreshing';
import { type GitLink, rowStaleness } from './staleness';
import { type BoardCell } from './types';

/** What deriving any row of one dashboard needs. */
export interface DeriveEnv {
  client: QueryClient;
  providers: QueryProviders;
  budgets: BudgetStore;
  /** The clock rows are derived by (refreshing, Decision 46). */
  now: () => number;
  /** When a query's fetch under way started (Decision 47). */
  fetchStartedAt: RefreshClock['fetchStartedAt'];
}

/** A derived row. */
export interface RowEntry {
  cells: BoardCell[];
  needs: Need[];
  derivation: RowDerivation;
  /** The groups it feeds (see `githubGroupId`, `amplifyGroupId`). */
  groups: string[];
}

export const githubGroupId = (credentialId: string, repo: string): string =>
  JSON.stringify(['github', credentialId, repo]);
export const amplifyGroupId = (key: string): string =>
  JSON.stringify(['amplify', key]);

/** Is `credentialId`'s token past its polling share (it polls slower)? */
export const overBudget = (
  env: Pick<DeriveEnv, 'budgets'>,
  credentialId: string,
): boolean => isOverPollingShare(env.budgets.get(credentialId));

export function githubContext(
  env: DeriveEnv,
  dashboard: Dashboard,
  credentialId: string,
  repo: string,
  stages: readonly Stage[] = dashboard.stages,
): GithubContext {
  return {
    client: env.client,
    credentialId,
    repo,
    source: sourceRuleFor(dashboard, 'github'),
    stages,
    rulesFor: (row: GithubRow, stageId) =>
      cellRulesFor(dashboard, row, stageId),
    overBudget: overBudget(env, credentialId),
    now: env.now(),
    fetchStartedAt: env.fetchStartedAt,
  };
}

export function amplifyContext(
  env: DeriveEnv,
  dashboard: Dashboard,
): AmplifyContext {
  // One read of each key's search per context.
  const searches = new Map<string, AppSearch>();
  return {
    client: env.client,
    stages: dashboard.stages,
    rulesFor: (row: AmplifyRow, stageId) =>
      cellRulesFor(dashboard, row, stageId),
    keyFor: (row, stageId) =>
      resolveSetting(dashboard, row, stageId, 'awsKey').value,
    hasReader: (id) => env.providers.amplify(id) !== undefined,
    search: (id) => {
      const found = searches.get(id) ?? appSearch(env.client, id);
      searches.set(id, found);
      return found;
    },
    keyLabel: (id) => credentialName(dashboard, id),
    source: sourceRuleFor(dashboard, 'amplify'),
    now: env.now(),
    fetchStartedAt: env.fetchStartedAt,
  };
}

/** The GitHub token each cell of `row` reads with, by stage id, when its
 * secret is entered. */
export function githubAccess(
  env: Pick<DeriveEnv, 'providers'>,
  dashboard: Dashboard,
  row: Row,
): Map<string, string | undefined> {
  const tokens = cellCredentials(dashboard, row, 'githubToken');
  return new Map(
    [...tokens].map(([stageId, id]) => [
      stageId,
      id && env.providers.github(id) ? id : undefined,
    ]),
  );
}

function providerDerivation(
  env: DeriveEnv,
  dashboard: Dashboard,
  row: Row,
  access: Map<string, string | undefined>,
): { derivation: RowDerivation; groups: string[] } {
  if (row.type === 'amplify') {
    const ctx = amplifyContext(env, dashboard);
    return {
      derivation: deriveAmplifyRow(ctx, row),
      groups: rowApps(ctx, row).map((app) => amplifyGroupId(appKey(app))),
    };
  }
  const parts = segments(dashboard.stages, (stageId) => access.get(stageId));
  return {
    derivation: mergeDerivations(
      parts.map(({ key, stages }) =>
        key
          ? deriveGithubRow(
              githubContext(env, dashboard, key, row.repo, stages),
              row,
            )
          : {
              cells: emptyViews(
                stages,
                (stageId) => cellRulesFor(dashboard, row, stageId).set,
                'missing',
              ),
              needs: [],
              problems: [],
            },
      ),
    ),
    groups: parts.flatMap(({ key }) =>
      key ? [githubGroupId(key, row.repo)] : [],
    ),
  };
}

/** `row` derived from the cache. */
export function deriveRow(
  env: DeriveEnv,
  dashboard: Dashboard,
  row: Row,
): RowEntry {
  const access = githubAccess(env, dashboard, row);
  const { derivation, groups } = providerDerivation(
    env,
    dashboard,
    row,
    access,
  );
  const { repo } = row;
  const linkFor = (stageId: string): GitLink | undefined => {
    const id = access.get(stageId);
    return id && repo
      ? {
          client: env.client,
          credentialId: id,
          repo,
          overBudget: overBudget(env, id),
        }
      : undefined;
  };
  const { staleness, needs } = rowStaleness(
    linkFor,
    dashboard.stages,
    derivation.cells,
  );
  const cells: BoardCell[] = [];
  for (const stage of dashboard.stages) {
    const view = derivation.cells[stage.id];
    const stale = staleness[stage.id];
    if (!view || !stale) continue;
    cells.push({
      rowId: row.id,
      stageId: stage.id,
      derivation: view.derivation,
      active: view.active,
      badge: stale.badge,
      ...(stale.compare ? { compare: stale.compare } : {}),
      ...(view.provisional ? { provisional: view.provisional } : {}),
      ...(view.refreshing ? { refreshing: true } : {}),
      settled: !view.pending && stale.settled,
    });
  }
  return { cells, needs: [...derivation.needs, ...needs], derivation, groups };
}
