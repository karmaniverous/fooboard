/**
 * Board engine (spec.md §8 step 7): joins a dashboard's config, providers
 * and the domain rules into a live cell model. Nothing is persisted; the
 * model is rebuilt from the providers when the board opens (spec.md C-17)
 * and kept fresh by the poll scheduler (C-16). Plain TypeScript with a
 * subscribe API; every update publishes a new model object.
 *
 * Poll targets are GitHub repos (all rows reading one repo with one token,
 * fetched together) and Amplify rows. A target never refreshes twice at
 * once: polling and `refreshAll` share its in-flight refresh.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { group, unique } from 'radash';

import { cellRulesFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  inheritedCredentials,
  rowGithubCredentialId,
} from '@/domain/config/inheritance';
import type { AmplifyRow, GithubRow, Row } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import type { Problem } from '@/domain/problems/problem';
import { translationProblems } from '@/domain/problems/runtime';
import type { GitHubReader } from '@/lib/github';
import { isOverPollingShare } from '@/lib/github';

import {
  amplifyGroups,
  refreshAmplifyTarget,
  rowAppKeys,
} from './amplifyTarget';
import { budgetTargets, githubCredentialIds } from './budgets';
import { refreshGithubRepo } from './githubRow';
import { emptyModel, type RowUpdate, withRows } from './model';
import {
  createPollScheduler,
  joinInFlight,
  type PollTarget,
  type Timers,
  type Visibility,
} from './scheduler';
import { compareOnce, readStaleness } from './staleness';
import {
  type BoardModel,
  cellKey,
  type EngineProviders,
  type UnmappedRun,
} from './types';
import { windowHints } from './windowHints';

export interface BoardEngine {
  /** Refresh every row now, then keep polling. */
  start(): void;
  stop(): void;
  /** Refresh every row once (no polling). */
  refreshAll(): Promise<void>;
  getModel(): BoardModel;
  subscribe(listener: (model: BoardModel) => void): () => void;
}

/** The GitHub token a row reads with, and its reader if entered. */
interface GithubAccess {
  credentialId: string;
  reader: GitHubReader | undefined;
}

/** Create the engine for one dashboard. */
export function createBoardEngine({
  dashboard,
  providers,
  timers,
  visibility,
  now = Date.now,
  onError,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  timers?: Timers;
  visibility?: Visibility;
  now?: () => number;
  onError?: (targetId: string, err: unknown) => void;
}): BoardEngine {
  const { stages } = dashboard;

  const rulesFor = (row: Row, stageId: string) =>
    cellRulesFor(dashboard, row, stageId);

  /** The token a row reads GitHub with (C-1a), and its reader. */
  const githubAccess = (row: Row): GithubAccess | undefined => {
    const credentialId = rowGithubCredentialId(dashboard, row);
    return credentialId
      ? { credentialId, reader: providers.github(credentialId) }
      : undefined;
  };
  const credentialIds = githubCredentialIds(dashboard);
  let model = emptyModel(credentialIds);
  const unmappedByTarget = new Map<string, UnmappedRun[]>();
  const problemsByTarget = new Map<string, Problem[]>();
  const listeners = new Set<(m: BoardModel) => void>();
  const publish = (next: BoardModel): void => {
    model = next;
    for (const listener of listeners) listener(model);
  };

  const branchesByTarget = new Map<string, JSONValue[]>();
  const budgetsWith = (accesses: readonly (GithubAccess | undefined)[]) => {
    const budgets = { ...model.budgets };
    for (const access of accesses)
      if (access?.reader)
        budgets[access.credentialId] = access.reader.getBudget();
    return budgets;
  };

  /** Publish one target's rows, its unmapped records, problems and branch
   * samples, and the budgets of the tokens it used. */
  const apply = (
    targetId: string,
    rows: Record<string, RowUpdate>,
    unmapped: UnmappedRun[],
    accesses: readonly (GithubAccess | undefined)[],
    problems: Problem[] = [],
    branches: JSONValue[] = [],
  ): void => {
    unmappedByTarget.set(targetId, unmapped);
    problemsByTarget.set(targetId, problems);
    branchesByTarget.set(targetId, branches);
    publish({
      ...withRows(model, stages, rows, now()),
      unmapped: unique([...unmappedByTarget.values()].flat(), (u) => u.id),
      problems: unique([...problemsByTarget.values()].flat(), (p) => p.id),
      amplifyBranches: [...branchesByTarget.values()].flat(),
      budgets: budgetsWith(accesses),
    });
  };

  /** Rate limited: keep the cells, but record the budget GitHub reported. */
  const applyBudgetOnly = (access: GithubAccess | undefined): void => {
    publish({ ...model, budgets: budgetsWith([access]) });
  };

  const githubRows = dashboard.rows.filter(
    (r): r is GithubRow => r.type === 'github',
  );
  const rowsByRepo = group(githubRows, (r) => r.repo);
  const githubSource = sourceRuleFor(dashboard, 'github');

  const refreshGithubGroup = async (
    targetId: string,
    rows: GithubRow[],
  ): Promise<void> => {
    const first = rows.at(0);
    if (!first) return;
    const access = githubAccess(first);
    const result = await refreshGithubRepo(
      {
        rows,
        repoRows: rowsByRepo[first.repo] ?? rows,
        stages,
        rulesFor,
        source: githubSource,
      },
      access?.reader,
    );
    if (result.kind === 'rate-limited') {
      applyBudgetOnly(access);
      return;
    }
    const reader = access?.reader;
    const compare = reader ? compareOnce(reader, first.repo) : undefined;
    const applied: Parameters<typeof apply>[1] = {};
    for (const row of rows) {
      const cells = result.rows[row.id] ?? {};
      applied[row.id] = {
        cells,
        staleness: compare
          ? await readStaleness(stages, reader, cells, compare)
          : {},
      };
    }
    const hints = result.full ? windowHints(result.rows, githubSource) : [];
    apply(
      targetId,
      applied,
      result.unmapped,
      [access],
      [...translationProblems(githubSource, result.keyProblems), ...hints],
    );
  };

  const defaultsFor = (row: AmplifyRow) =>
    inheritedCredentials(dashboard, row.id);
  const readersFor = (id: string) => providers.amplify(id);
  const refreshAmplify = async (
    targetId: string,
    rows: AmplifyRow[],
  ): Promise<void> => {
    const result = await refreshAmplifyTarget({
      rows,
      stages,
      rulesFor,
      defaultsFor,
      readersFor,
      source: sourceRuleFor(dashboard, 'amplify'),
      githubFor: (row) => githubAccess(row)?.reader,
    });
    const accesses = rows.map(githubAccess);
    if (result.kind === 'rate-limited') {
      publish({ ...model, budgets: budgetsWith(accesses) });
      return;
    }
    apply(
      targetId,
      result.rows,
      result.unmapped,
      accesses,
      result.problems,
      result.branches,
    );
  };

  // GitHub targets: the rows reading one repo with one token.
  const githubGroups = group(githubRows, (r) =>
    JSON.stringify([githubAccess(r)?.credentialId ?? null, r.repo]),
  );

  const once = joinInFlight();

  const isActive = (rowIds: readonly string[]): boolean =>
    rowIds.some((rowId) =>
      stages.some((s) => model.cells[cellKey(rowId, s.id)]?.active === true),
    );

  const targets: PollTarget[] = [
    ...Object.entries(githubGroups).map(([key, rows = []]) => {
      const id = `github:${key}`;
      return {
        id,
        refresh: () => once(id, () => refreshGithubGroup(id, rows)),
        isActive: () => isActive(rows.map((r) => r.id)),
      };
    }),
    ...amplifyGroups(
      dashboard.rows.filter((r): r is AmplifyRow => r.type === 'amplify'),
      (row) => rowAppKeys(row, defaultsFor(row), readersFor),
    ).map((rows) => {
      const id = `amplify:${rows.map((r) => r.id).join(',')}`;
      return {
        id,
        refresh: () => once(id, () => refreshAmplify(id, rows)),
        isActive: () => isActive(rows.map((r) => r.id)),
      };
    }),
  ];

  targets.push(
    ...budgetTargets({
      credentialIds,
      reader: (id) => providers.github(id),
      onBudget: (id, budget) => {
        publish({ ...model, budgets: { ...model.budgets, [id]: budget } });
      },
      now,
    }),
  );

  const scheduler = createPollScheduler({
    targets,
    overBudget: () =>
      Object.values(model.budgets).some((b) => b && isOverPollingShare(b)),
    timers,
    visibility,
    onError,
  });

  return {
    start: () => {
      scheduler.start();
    },
    stop: () => {
      scheduler.stop();
    },
    refreshAll: async () => {
      await Promise.all(targets.map((t) => t.refresh()));
    },
    getModel: () => model,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
