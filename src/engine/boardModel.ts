/**
 * The board model (spec.md §3.1): framework-free, it derives each row
 * from the query cache and keeps observed exactly the queries the rows
 * need. A landed query re-derives only the rows it feeds, and with them
 * the Unmapped runs and problems of their groups, so the board fills
 * progressively (runs, then jobs, then behind). An edit re-derives from
 * the cache at once, so the board never blanks; a token passing half its
 * budget slows its polling. React only subscribes to it.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowGithubCredentialId } from '@/domain/config/inheritance';
import { isOverPollingShare } from '@/lib/github';
import type { QueryEnv } from '@/query/client';

import { computeGroup, type GroupEntry, planGroups } from './groups';
import { emptyModel, githubCredentialIds } from './model';
import { createObserverSet, mergeNeeds } from './observers';
import { type DeriveEnv, deriveRow, type RowEntry } from './rowDerive';
import { failedRow } from './rowFailure';
import { type BoardModel, cellKey } from './types';

/** The query actions that change what a row derives. */
const DATA_ACTIONS = new Set(['success', 'error', 'setState']);

export interface BoardModelHandle {
  getModel(): BoardModel;
  /** Hear every published model; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Re-derive for an edited dashboard, from the cache, at once. */
  setDashboard(dashboard: Dashboard): void;
  /** Re-derive every row (a secret was entered or changed). */
  refresh(): void;
  destroy(): void;
}

export function createBoardModel({
  dashboard: initial,
  env,
  now = Date.now,
}: {
  dashboard: Dashboard;
  env: QueryEnv;
  now?: () => number;
}): BoardModelHandle {
  let dashboard = initial;
  let destroyed = false;
  let scheduled = false;
  let model = emptyModel(githubCredentialIds(dashboard));
  const derive: DeriveEnv = {
    client: env.client,
    providers: env.providers,
    budgets: env.budgets,
    openedAt: now(),
  };
  const rows = new Map<string, RowEntry>();
  const groups = new Map<string, GroupEntry>();
  const dirty = new Set<string>();
  const listeners = new Set<() => void>();
  const observers = createObserverSet(env.client);
  let feeds = new Map<string, Set<string>>();
  const overBudget = new Map<string, boolean>();

  const publish = () => {
    const cells: BoardModel['cells'] = {};
    const refreshedAt: BoardModel['refreshedAt'] = {};
    for (const [rowId, entry] of rows) {
      for (const cell of entry.cells)
        cells[cellKey(cell.rowId, cell.stageId)] = cell;
      const at = entry.derivation.refreshedAt;
      if (at !== undefined) refreshedAt[rowId] = at;
    }
    const all = [...groups.values()];
    model = {
      cells,
      refreshedAt,
      unmapped: unique(
        all.flatMap((g) => g.unmapped),
        (u) => u.id,
      ),
      problems: unique(
        [
          ...[...rows.values()].flatMap((r) => r.derivation.problems),
          ...all.flatMap((g) => g.problems),
        ],
        (p) => p.id,
      ),
      amplifyBranches: all.flatMap((g) => g.branches),
      budgets: Object.fromEntries(
        githubCredentialIds(dashboard).map((id) => [id, env.budgets.get(id)]),
      ),
    };
    for (const listener of listeners) listener();
  };

  /** A row's entry; an exception in deriving it shows on its cells as
   * *Error* and as a dismissable problem (Decision 25). */
  const deriveSafely = (row: Dashboard['rows'][number]): RowEntry => {
    try {
      return deriveRow(derive, dashboard, row);
    } catch (err) {
      return failedRow(dashboard, row, err, rows.get(row.id));
    }
  };

  const flush = () => {
    scheduled = false;
    if (destroyed) return;
    const byId = new Map(dashboard.rows.map((row) => [row.id, row]));
    const touched = new Set<string>();
    for (const rowId of dirty) {
      for (const group of rows.get(rowId)?.groups ?? []) touched.add(group);
      const row = byId.get(rowId);
      if (!row) {
        rows.delete(rowId);
        continue;
      }
      const entry = deriveSafely(row);
      rows.set(rowId, entry);
      for (const group of entry.groups) touched.add(group);
    }
    dirty.clear();
    const plans = planGroups(derive, dashboard);
    for (const id of touched) {
      const plan = plans.get(id);
      if (plan) groups.set(id, computeGroup(derive, dashboard, plan, rows));
      else groups.delete(id);
    }
    const needs = mergeNeeds(
      [...rows].map(([rowId, entry]) => [rowId, entry.needs] as const),
    );
    feeds = new Map([...needs].map(([hash, need]) => [hash, need.feeds]));
    observers.sync(needs);
    publish();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  };

  const markAll = () => {
    for (const rowId of rows.keys()) dirty.add(rowId);
    for (const row of dashboard.rows) dirty.add(row.id);
  };

  const unsubscribeCache = env.client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && !DATA_ACTIONS.has(event.action.type))
      return;
    if (event.type !== 'updated' && event.type !== 'removed') return;
    const fed = feeds.get(event.query.queryHash);
    if (!fed) return;
    for (const rowId of fed) dirty.add(rowId);
    schedule();
  });

  // Budgets publish with the next flush; a token crossing half its
  // budget re-derives its rows (their polling slows or speeds).
  const unsubscribeBudgets = env.budgets.subscribe(() => {
    for (const id of githubCredentialIds(dashboard)) {
      const over = isOverPollingShare(env.budgets.get(id));
      if ((overBudget.get(id) ?? false) === over) continue;
      overBudget.set(id, over);
      for (const row of dashboard.rows)
        if (rowGithubCredentialId(dashboard, row) === id) dirty.add(row.id);
    }
    schedule();
  });

  env.limiters.configure(dashboard);
  markAll();
  flush();

  return {
    getModel: () => model,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setDashboard(next) {
      if (next === dashboard) return;
      dashboard = next;
      env.limiters.configure(next);
      markAll();
      flush();
    },
    refresh() {
      markAll();
      flush();
    },
    destroy() {
      destroyed = true;
      unsubscribeCache();
      unsubscribeBudgets();
      observers.destroy();
      listeners.clear();
    },
  };
}
