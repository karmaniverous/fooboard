/**
 * A group's Unmapped runs and problems (spec.md §2.5, §3.1, §3.12): a
 * GitHub token's repo or an Amplify app, recomputed with the rows its
 * queries feed, each judged against only the cells that read it (a
 * token's cells, an app's cells), with window hints for those cells
 * only (an Amplify cell with a branch-pattern stage rule hinted only when
 * a branch it matches was read full, Decision 94). Amplify groups also
 * carry the app's branch list entries for the branch rule's sample. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { keepsBuiltinBranch } from '@/domain/model/builtinSources';
import type { Problem } from '@/domain/problems/problem';
import { translationProblems } from '@/domain/problems/runtime';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';

import { readApps } from './amplifyAccess';
import { appState } from './amplifyApp';
import { amplifyUnmapped } from './amplifyUnmapped';
import { githubGroup, type GithubReader } from './githubGroup';
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
import { amplifyCellFull, fullReadHints, servedBy } from './windowHints';

export interface GroupEntry {
  unmapped: UnmappedRun[];
  /** Runs the group's cells place: listed unmapped by no other group. */
  mapped: string[];
  problems: Problem[];
  branches: JSONValue[];
}

/** A row reading an Amplify app, and its columns that do. */
interface AmplifyReader {
  row: AmplifyRow;
  stageIds: readonly string[];
}

/** Every group of `dashboard`, by id, with what computing it needs. */
type GroupPlan =
  | {
      kind: 'github';
      credentialId: string;
      repo: string;
      readers: GithubReader[];
    }
  | { kind: 'amplify'; app: ResolvedAmplifySource; readers: AmplifyReader[] };

export function planGroups(
  env: DeriveEnv,
  dashboard: Dashboard,
): Map<string, GroupPlan> {
  const plans = new Map<string, GroupPlan>();
  const ctx = amplifyContext(env, dashboard);
  for (const row of dashboard.rows) {
    if (row.type === 'github') {
      // One group per token the row's cells read with, serving those
      // cells only.
      const byToken = new Map<string, string[]>();
      for (const [stageId, credentialId] of githubAccess(env, dashboard, row))
        if (credentialId)
          byToken.set(credentialId, [
            ...(byToken.get(credentialId) ?? []),
            stageId,
          ]);
      for (const [credentialId, stageIds] of byToken) {
        const id = githubGroupId(credentialId, row.repo);
        const plan = plans.get(id);
        const reader = { row, stageIds };
        if (plan?.kind === 'github') plan.readers.push(reader);
        else
          plans.set(id, {
            kind: 'github',
            credentialId,
            repo: row.repo,
            readers: [reader],
          });
      }
      continue;
    }
    for (const { app, stageIds } of readApps(ctx, row)) {
      const id = amplifyGroupId(appKey(app));
      const plan = plans.get(id);
      const reader = { row, stageIds };
      if (plan?.kind === 'amplify') plan.readers.push(reader);
      else plans.set(id, { kind: 'amplify', app, readers: [reader] });
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
    const ctx = githubContext(env, dashboard, plan.credentialId, plan.repo);
    return { ...githubGroup(ctx, plan.readers, cells), branches: [] };
  }
  const ctx = amplifyContext(env, dashboard);
  const app = appState(env.client, plan.app, ctx.source);
  const unmapped = amplifyUnmapped(
    plan.readers,
    ctx.rulesFor,
    appKey(plan.app),
    app.records,
  );
  const appWide = !keepsBuiltinBranch(ctx.source);
  const readers = new Map(plan.readers.map((r) => [r.row.id, r.row]));
  const hints = fullReadHints(
    (rowId, stageId) => {
      const row = readers.get(rowId);
      const stageRule = row && ctx.rulesFor(row, stageId).stage;
      return amplifyCellFull(app, stageRule, appWide);
    },
    servedBy(plan.readers),
    cells,
    ctx.source,
  );
  return {
    unmapped,
    mapped: [],
    problems: [...translationProblems(ctx.source, app.keyProblems), ...hints],
    branches: app.branches,
  };
}
