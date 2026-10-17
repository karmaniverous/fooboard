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

import { effectiveStages } from '@/domain/config/branchOverrides';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGroupOf } from '@/domain/config/groups';
import type { AmplifyRow, GithubRow, Row } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import type { CompareResult, GitHubReader } from '@/lib/github';
import { isOverPollingShare } from '@/lib/github';

import { refreshAmplifyRow } from './amplifyRow';
import { type DatedBranch, refreshGithubRepo, repoRef } from './githubRow';
import {
  createPollScheduler,
  type PollTarget,
  type Timers,
  type Visibility,
} from './scheduler';
import { type CellStaleness, rowStaleness } from './staleness';
import {
  type BoardCell,
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

/** What a provider refresh yields per cell, before staleness. */
type CellView = Pick<BoardCell, 'derivation' | 'active'>;

/** The GitHub token a row reads with, and its reader if entered. */
interface GithubAccess {
  credentialId: string;
  reader: GitHubReader | undefined;
}

/** A model with nothing loaded yet. */
export const emptyModel = (): BoardModel => ({
  cells: {},
  unmapped: [],
  budgets: {},
  refreshedAt: {},
});

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
  const { stages, mapping, defaultCredentials } = dashboard;

  /** The stages as `row` sees them: effective branch patterns (C-14c). */
  const stagesByRow = new Map<string, readonly Stage[]>(
    dashboard.rows.map((r) => [r.id, effectiveStages(dashboard, r)]),
  );
  const stagesFor = (row: Row): readonly Stage[] =>
    stagesByRow.get(row.id) ?? stages;
  /** The row group's default credentials, if the row is in one (C-1a). */
  const groupDefaultsOf = (row: Row) =>
    rowGroupOf(dashboard.rowGroups, row.id)?.defaultCredentials;

  /** A row's override, else its group's default, else the dashboard
   * default (spec.md C-1a). */
  const githubAccess = (
    row: Row,
    override?: string,
  ): GithubAccess | undefined => {
    const credentialId = resolveCredentialId(
      defaultCredentials,
      'github',
      override,
      groupDefaultsOf(row),
    );
    return credentialId
      ? { credentialId, reader: providers.github(credentialId) }
      : undefined;
  };

  let model = emptyModel();
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
    rows: Record<
      string,
      {
        cells: Partial<Record<string, CellView>>;
        staleness: Record<string, CellStaleness>;
      }
    >,
    unmapped: UnmappedRun[],
    access: GithubAccess | undefined,
  ): void => {
    const cells = { ...model.cells };
    const refreshedAt = { ...model.refreshedAt };
    for (const [rowId, row] of Object.entries(rows)) {
      for (const stage of stages) {
        const view = row.cells[stage.id];
        if (!view) continue;
        cells[cellKey(rowId, stage.id)] = {
          rowId,
          stageId: stage.id,
          ...view,
          ...(row.staleness[stage.id] ?? { badge: undefined }),
        };
      }
      refreshedAt[rowId] = now();
    }
    unmappedByTarget.set(targetId, unmapped);
    publish({
      cells,
      unmapped: unique(
        [...unmappedByTarget.values()].flat(),
        (u) => `${u.repo}#${String(u.runId)}`,
      ),
      budgets: budgetsWith(access),
      refreshedAt,
    });
  };

  /** Rate limited: keep the cells, but record the budget GitHub reported. */
  const applyBudgetOnly = (access: GithubAccess | undefined): void => {
    publish({ ...model, budgets: budgetsWith(access) });
  };

  /** Staleness for one row. Compares are shared across the rows of one
   * refresh through `compare`; badges are best-effort. */
  const stalenessFor = async (
    rowStages: readonly Stage[],
    reader: GitHubReader | undefined,
    repo: string,
    cells: Record<string, CellView>,
    branches: DatedBranch[] | undefined,
    compare: (base: string, head: string) => Promise<CompareResult>,
  ): Promise<Record<string, CellStaleness>> => {
    if (!reader) return {};
    try {
      const dated =
        branches ??
        (await reader.listBranches(repoRef(repo))).map((b) => ({
          name: b.name,
          updatedAt: new Date(0).toISOString(),
        }));
      const derivations = Object.fromEntries(
        Object.entries(cells).map(([id, c]) => [id, c.derivation]),
      );
      return await rowStaleness(rowStages, derivations, dated, compare);
    } catch {
      return {};
    }
  };

  /** One compare per branch pair within a refresh. */
  const compareOnce = (reader: GitHubReader, repo: string) => {
    const seen = new Map<string, Promise<CompareResult>>();
    return (base: string, head: string): Promise<CompareResult> => {
      const key = `${base}...${head}`;
      let pending = seen.get(key);
      if (!pending) {
        pending = reader.compare(repoRef(repo), base, head);
        seen.set(key, pending);
      }
      return pending;
    };
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
    const access = githubAccess(first, first.credentialId);
    const result = await refreshGithubRepo(
      rows,
      rowsByRepo[first.repo] ?? rows,
      stages,
      mapping,
      access?.reader,
      stagesFor,
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
        staleness:
          compare && result.branches.length > 0
            ? await stalenessFor(
                stagesFor(row),
                reader,
                row.repo,
                cells,
                result.branches,
                compare,
              )
            : {},
      };
    }
    apply(targetId, applied, result.unmapped, access);
  };

  const refreshAmplify = async (row: AmplifyRow): Promise<void> => {
    const result = await refreshAmplifyRow(
      row,
      stagesFor(row),
      defaultCredentials,
      (id) => providers.amplify(id),
      groupDefaultsOf(row),
    );
    const access = githubAccess(row, row.githubCredentialId);
    if (result.kind === 'rate-limited') {
      applyBudgetOnly(access);
      return;
    }
    const cells: Record<string, CellView> = {};
    for (const [stageId, derivation] of Object.entries(result.cells)) {
      cells[stageId] = {
        derivation,
        active:
          derivation.kind === 'ok' &&
          (derivation.status === 'started' || derivation.status === 'queued'),
      };
    }
    const reader = access?.reader;
    const staleness = reader
      ? await stalenessFor(
          stagesFor(row),
          reader,
          row.repo,
          cells,
          undefined,
          compareOnce(reader, row.repo),
        )
      : {};
    apply(row.id, { [row.id]: { cells, staleness } }, [], access);
  };

  // GitHub targets: the rows reading one repo with one token.
  const githubGroups = group(githubRows, (r) =>
    JSON.stringify([
      githubAccess(r, r.credentialId)?.credentialId ?? null,
      r.repo,
    ]),
  );

  const inFlight = new Map<string, Promise<void>>();
  /** Join a target's running refresh rather than starting another. */
  const once = (id: string, refresh: () => Promise<void>): Promise<void> => {
    let pending = inFlight.get(id);
    if (!pending) {
      pending = refresh().finally(() => inFlight.delete(id));
      inFlight.set(id, pending);
    }
    return pending;
  };

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
