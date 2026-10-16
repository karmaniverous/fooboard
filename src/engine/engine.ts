/**
 * Board engine (spec.md §8 step 7): joins a dashboard's config, providers
 * and the domain rules into a live cell model. Nothing is persisted; the
 * model is rebuilt from the providers when the board opens (spec.md C-17)
 * and kept fresh by the poll scheduler (C-16). Plain TypeScript with a
 * subscribe API; every update publishes a new model object.
 *
 * @module
 */
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, GithubRow } from '@/domain/config/row';
import type { GitHubReader } from '@/lib/github';

import { refreshAmplifyRow } from './amplifyRow';
import { refreshGithubRow, repoRef } from './githubRow';
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

const emptyModel = (): BoardModel => ({
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
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  timers?: Timers;
  visibility?: Visibility;
  now?: () => number;
}): BoardEngine {
  const { stages, mapping } = dashboard;
  const { defaultCredentials } = dashboard;

  /** The GitHub token a row reads with: its override, else the dashboard
   * default (spec.md C-1a). */
  interface GithubAccess {
    credentialId: string;
    reader: GitHubReader | undefined;
  }
  const githubAccess = (override?: string): GithubAccess | undefined => {
    const credentialId = resolveCredentialId(
      defaultCredentials,
      'github',
      override,
    );
    return credentialId
      ? { credentialId, reader: providers.github(credentialId) }
      : undefined;
  };

  let model = emptyModel();
  const listeners = new Set<(m: BoardModel) => void>();
  const publish = (next: BoardModel): void => {
    model = next;
    for (const listener of listeners) listener(model);
  };

  const applyRow = (
    rowId: string,
    cells: Partial<Record<string, BoardCell['derivation']>>,
    staleness: Partial<Record<string, CellStaleness>>,
    unmapped: UnmappedRun[],
    access: GithubAccess | undefined,
  ): void => {
    const nextCells = { ...model.cells };
    for (const stage of stages) {
      const derivation = cells[stage.id];
      if (!derivation) continue;
      nextCells[cellKey(rowId, stage.id)] = {
        rowId,
        stageId: stage.id,
        derivation,
        ...(staleness[stage.id] ?? { badge: undefined }),
      };
    }
    publish({
      cells: nextCells,
      unmapped: [
        ...model.unmapped.filter((u) => u.rowId !== rowId),
        ...unmapped,
      ],
      budgets: access?.reader
        ? { ...model.budgets, [access.credentialId]: access.reader.getBudget() }
        : model.budgets,
      refreshedAt: { ...model.refreshedAt, [rowId]: now() },
    });
  };

  /** Badges are best-effort: a failed compare leaves the row unbadged. */
  const stalenessFor = async (
    reader: GitHubReader | undefined,
    repo: string,
    cells: Record<string, BoardCell['derivation']>,
    branches: { name: string; updatedAt: string }[] | undefined,
  ): Promise<Record<string, CellStaleness>> => {
    if (!reader) return {};
    try {
      const ref = repoRef(repo);
      const dated =
        branches ??
        (await reader.listBranches(ref)).map((b) => ({
          name: b.name,
          updatedAt: new Date(0).toISOString(),
        }));
      return await rowStaleness(stages, cells, dated, (base, head) =>
        reader.compare(ref, base, head),
      );
    } catch {
      return {};
    }
  };

  const refreshGithub = async (row: GithubRow): Promise<void> => {
    const access = githubAccess(row.credentialId);
    const result = await refreshGithubRow(row, stages, mapping, access?.reader);
    if (result.kind === 'rate-limited') return;
    const staleness =
      result.branches.length > 0
        ? await stalenessFor(
            access?.reader,
            row.repo,
            result.cells,
            result.branches,
          )
        : {};
    applyRow(row.id, result.cells, staleness, result.unmapped, access);
  };

  const refreshAmplify = async (row: AmplifyRow): Promise<void> => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      defaultCredentials,
      (id) => providers.amplify(id),
    );
    if (result.kind === 'rate-limited') return;
    const access = githubAccess(row.githubCredentialId);
    const staleness = await stalenessFor(
      access?.reader,
      row.repo,
      result.cells,
      undefined,
    );
    applyRow(row.id, result.cells, staleness, [], access);
  };

  const targets: PollTarget[] = dashboard.rows.map((row) => ({
    id: row.id,
    refresh: () =>
      row.type === 'github' ? refreshGithub(row) : refreshAmplify(row),
    isActive: () =>
      stages.some((s) => {
        const d = model.cells[cellKey(row.id, s.id)]?.derivation;
        return (
          d?.kind === 'ok' && (d.status === 'started' || d.status === 'queued')
        );
      }),
  }));

  const scheduler = createPollScheduler({
    targets,
    overBudget: () =>
      Object.values(model.budgets).some((b) => b && b.used > b.limit / 2),
    timers,
    visibility,
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
