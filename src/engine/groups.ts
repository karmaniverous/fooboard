/**
 * A group's Unmapped runs and problems (spec.md §2.5, §3.1): a GitHub
 * token's repo or an Amplify app, recomputed with the rows its queries
 * feed. Amplify groups also carry the app's branch list entries for the
 * branch rule's sample. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, GithubRow } from '@/domain/config/row';
import type { Problem } from '@/domain/problems/problem';
import { translationProblems } from '@/domain/problems/runtime';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';

import { appState } from './amplifyApp';
import { resolvedSources } from './amplifyRow';
import { amplifyUnmapped } from './amplifyUnmapped';
import { githubGroup } from './githubGroup';
import {
  amplifyContext,
  amplifyGroupId,
  type DeriveEnv,
  githubAccess,
  githubContext,
  githubGroupId,
  type RowEntry,
} from './rowDerive';
import type { CellView, UnmappedRun } from './types';
import { fullReadHints } from './windowHints';

export interface GroupEntry {
  unmapped: UnmappedRun[];
  problems: Problem[];
  branches: JSONValue[];
}

/** Every group of `dashboard`, by id, with what computing it needs. */
type GroupPlan =
  | { kind: 'github'; credentialId: string; repo: string; rows: GithubRow[] }
  | {
      kind: 'amplify';
      app: ResolvedAmplifySource;
      readers: Map<AmplifyRow, ResolvedAmplifySource[]>;
    };

export function planGroups(
  env: DeriveEnv,
  dashboard: Dashboard,
): Map<string, GroupPlan> {
  const plans = new Map<string, GroupPlan>();
  const ctx = amplifyContext(env, dashboard);
  for (const row of dashboard.rows) {
    if (row.type === 'github') {
      const credentialId = githubAccess(env, dashboard, row);
      if (!credentialId) continue;
      const id = githubGroupId(credentialId, row.repo);
      const plan = plans.get(id);
      if (plan?.kind === 'github') plan.rows.push(row);
      else
        plans.set(id, {
          kind: 'github',
          credentialId,
          repo: row.repo,
          rows: [row],
        });
      continue;
    }
    const apps = resolvedSources(ctx, row) ?? [];
    for (const app of apps) {
      const id = amplifyGroupId(appKey(app));
      const plan = plans.get(id);
      if (plan?.kind === 'amplify') plan.readers.set(row, apps);
      else
        plans.set(id, {
          kind: 'amplify',
          app,
          readers: new Map([[row, apps]]),
        });
    }
  }
  return plans;
}

/** One group computed from the cache and its rows' derived cells. */
export function computeGroup(
  env: DeriveEnv,
  dashboard: Dashboard,
  plan: GroupPlan,
  rows: ReadonlyMap<string, RowEntry>,
): GroupEntry {
  const cells = (rowId: string): Partial<Record<string, CellView>> =>
    rows.get(rowId)?.derivation.cells ?? {};
  if (plan.kind === 'github') {
    const repoRows = dashboard.rows.filter(
      (r): r is GithubRow => r.type === 'github' && r.repo === plan.repo,
    );
    const ctx = githubContext(env, dashboard, plan.credentialId, plan.repo);
    return { ...githubGroup(ctx, plan.rows, repoRows, cells), branches: [] };
  }
  const ctx = amplifyContext(env, dashboard);
  const app = appState(env.client, plan.app, ctx.source);
  const readers = [...plan.readers.keys()];
  const reading = new Map(
    [...plan.readers].map(([row, apps]) => [row.id, apps]),
  );
  const unmapped = amplifyUnmapped(
    { rows: readers, stages: ctx.stages, rulesFor: ctx.rulesFor },
    reading,
    new Map([[appKey(plan.app), { records: app.records }]]),
  );
  const hints = fullReadHints(
    app.full,
    readers.map((r) => r.id),
    cells,
    ctx.source,
  );
  return {
    unmapped,
    problems: [...translationProblems(ctx.source, app.keyProblems), ...hints],
    branches: app.branches,
  };
}
