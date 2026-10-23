/**
 * One row of the board from the cache (spec.md §3.1): its provider's
 * derivation, then staleness through its git link, giving the row's
 * board cells, the queries it needs and the groups (a token's repo, an
 * Amplify app) whose Unmapped runs and problems it feeds. Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import { cellRulesFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  inheritedCredentials,
  rowGithubCredentialId,
} from '@/domain/config/inheritance';
import type { AmplifyRow, GithubRow, Row } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import { appKey } from '@/lib/amplify/rowJobs';
import { isOverPollingShare } from '@/lib/github';
import type { BudgetStore } from '@/query/budgets';
import type { QueryProviders } from '@/query/fetchers';

import {
  type AmplifyContext,
  deriveAmplifyRow,
  resolvedSources,
} from './amplifyRow';
import { emptyViews } from './cells';
import { deriveGithubRow, type GithubContext } from './githubRow';
import type { Need, RowDerivation } from './need';
import { type GitLink, rowStaleness } from './staleness';
import { type BoardCell } from './types';

/** What deriving any row of one dashboard needs. */
export interface DeriveEnv {
  client: QueryClient;
  providers: QueryProviders;
  budgets: BudgetStore;
  /** The clock rows are derived by (refreshing, Decision 46). */
  now: () => number;
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
): GithubContext {
  return {
    client: env.client,
    credentialId,
    repo,
    source: sourceRuleFor(dashboard, 'github'),
    stages: dashboard.stages,
    rulesFor: (row: GithubRow, stageId) =>
      cellRulesFor(dashboard, row, stageId),
    overBudget: overBudget(env, credentialId),
    now: env.now(),
  };
}

export function amplifyContext(
  env: DeriveEnv,
  dashboard: Dashboard,
): AmplifyContext {
  return {
    client: env.client,
    stages: dashboard.stages,
    rulesFor: (row: AmplifyRow, stageId) =>
      cellRulesFor(dashboard, row, stageId),
    defaultsFor: (row) => inheritedCredentials(dashboard, row.id),
    hasReader: (id) => env.providers.amplify(id) !== undefined,
    source: sourceRuleFor(dashboard, 'amplify'),
    now: env.now(),
  };
}

/** The GitHub token a row reads with, when its secret is entered. */
export function githubAccess(
  env: DeriveEnv,
  dashboard: Dashboard,
  row: Row,
): string | undefined {
  const id = rowGithubCredentialId(dashboard, row);
  return id && env.providers.github(id) ? id : undefined;
}

function providerDerivation(
  env: DeriveEnv,
  dashboard: Dashboard,
  row: Row,
): { derivation: RowDerivation; groups: string[] } {
  if (row.type === 'amplify') {
    const ctx = amplifyContext(env, dashboard);
    const apps = resolvedSources(ctx, row) ?? [];
    return {
      derivation: deriveAmplifyRow(ctx, row),
      groups: apps.map((app) => amplifyGroupId(appKey(app))),
    };
  }
  const credentialId = githubAccess(env, dashboard, row);
  if (!credentialId)
    return {
      derivation: {
        cells: emptyViews(
          dashboard.stages,
          (stageId) => cellRulesFor(dashboard, row, stageId).set,
          'missing',
        ),
        needs: [],
        problems: [],
      },
      groups: [],
    };
  return {
    derivation: deriveGithubRow(
      githubContext(env, dashboard, credentialId, row.repo),
      row,
    ),
    groups: [githubGroupId(credentialId, row.repo)],
  };
}

/** `row` derived from the cache. */
export function deriveRow(
  env: DeriveEnv,
  dashboard: Dashboard,
  row: Row,
): RowEntry {
  const { derivation, groups } = providerDerivation(env, dashboard, row);
  const linkId = row.repo ? githubAccess(env, dashboard, row) : undefined;
  const link: GitLink | undefined =
    linkId && row.repo
      ? {
          client: env.client,
          credentialId: linkId,
          repo: row.repo,
          overBudget: overBudget(env, linkId),
        }
      : undefined;
  const { staleness, needs } = rowStaleness(
    link,
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
