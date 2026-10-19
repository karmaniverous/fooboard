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
import { group, unique } from 'radash';

import { cellRulesFor, sourceFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  inheritedCredentials,
  rowGithubCredentialId,
} from '@/domain/config/inheritance';
import type { AmplifyRow, GithubRow, Row } from '@/domain/config/row';
import type { GitHubReader } from '@/lib/github';
import { isOverPollingShare } from '@/lib/github';

import { amplifyCellViews, refreshAmplifyRow } from './amplifyRow';
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
  const { stages, mapping } = dashboard;

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
  const listeners = new Set<(m: BoardModel) => void>();
  const publish = (next: BoardModel): void => {
    model = next;
    for (const listener of listeners) listener(model);
  };

  const budgetsWith = (access: GithubAccess | undefined) =>
    access?.reader
      ? { ...model.budgets, [access.credentialId]: access.reader.getBudget() }
      : model.budgets;

  /** Publish one target's rows, its unmapped runs and the token's budget. */
  const apply = (
    targetId: string,
    rows: Record<string, RowUpdate>,
    unmapped: UnmappedRun[],
    access: GithubAccess | undefined,
  ): void => {
    unmappedByTarget.set(targetId, unmapped);
    publish({
      ...withRows(model, stages, rows, now()),
      unmapped: unique(
        [...unmappedByTarget.values()].flat(),
        (u) => `${u.repo}#${String(u.runId)}`,
      ),
      budgets: budgetsWith(access),
    });
  };

  /** Rate limited: keep the cells, but record the budget GitHub reported. */
  const applyBudgetOnly = (access: GithubAccess | undefined): void => {
    publish({ ...model, budgets: budgetsWith(access) });
  };

  const githubRows = dashboard.rows.filter(
    (r): r is GithubRow => r.type === 'github',
  );
  const rowsByRepo = group(githubRows, (r) => r.repo);

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
        source: sourceFor('github'),
        mapping,
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
    apply(targetId, applied, result.unmapped, access);
  };

  const refreshAmplify = async (row: AmplifyRow): Promise<void> => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      (stageId) => rulesFor(row, stageId),
      inheritedCredentials(dashboard, row.id),
      (id) => providers.amplify(id),
    );
    const access = githubAccess(row);
    if (result.kind === 'rate-limited') {
      applyBudgetOnly(access);
      return;
    }
    const cells = amplifyCellViews(result.cells);
    const reader = access?.reader;
    const staleness = reader
      ? await readStaleness(
          stages,
          reader,
          cells,
          compareOnce(reader, row.repo),
        )
      : {};
    apply(row.id, { [row.id]: { cells, staleness } }, [], access);
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
    ...dashboard.rows
      .filter((r): r is AmplifyRow => r.type === 'amplify')
      .map((row) => {
        const id = `amplify:${row.id}`;
        return {
          id,
          refresh: () => once(id, () => refreshAmplify(row)),
          isActive: () => isActive([row.id]),
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
