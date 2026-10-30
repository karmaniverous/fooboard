/**
 * The board model (spec.md §3.1): framework-free, it derives each row
 * from the query cache and keeps observed exactly the queries the rows
 * need. A landed query re-derives only the rows it feeds, and with them
 * the Unmapped runs and problems of their groups, so the board fills
 * progressively (runs, then jobs, then behind). An edit re-derives from
 * the cache at once, so the board never blanks; a token passing half its
 * budget slows its polling. A fetch that runs longer than the
 * refreshing delay re-derives the rows it feeds once the delay passes.
 * The user's interest in a row (`attend`) boosts its polling, stepping on
 * as its root queries' polls complete (spec 0.2.0 §3.H; `attention.ts`).
 * Opening a board polls every row's roots at once (Decision 109).
 * React only subscribes to it.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowCredentials } from '@/domain/settings/credentials';
import type { QueryEnv } from '@/query/client';
import { type BoostKind, BUDGET_BACKOFF } from '@/query/intervals';

import { createAttention, rootCompletions } from './attention';
import { createFetchStarts } from './fetchStarts';
import { computeGroup, type GroupEntry, planGroups } from './groups';
import { keyApps } from './keyApps';
import { emptyModel, githubCredentialIds } from './model';
import type { Need } from './need';
import { createObserverSet, mergeNeeds } from './observers';
import { pollRootsNow } from './pollNow';
import {
  type DeriveEnv,
  deriveRow,
  overBudget,
  type RowEntry,
} from './rowDerive';
import { failedRow } from './rowFailure';
import { type BoardModel, cellKey } from './types';

/** The query actions that change what a row derives: its data or error
 * landing, and a fetch starting, pausing or resuming (refreshing,
 * Decision 46). */
const DERIVING_ACTIONS = new Set([
  'success',
  'error',
  'setState',
  'fetch',
  'pause',
  'continue',
]);

/** How many times slower than a boost's intervals `needs`' root queries
 * poll: `BUDGET_BACKOFF` when each is a GitHub read with a token past half
 * its budget, else 1. A row's fastest root decides, so a dwell's restart
 * never postpones any of its polls. */
const backoffOf = (env: QueryEnv, needs: readonly Need[]): number => {
  const roots = needs.filter((need) => need.root);
  return roots.length > 0 &&
    roots.every(({ key }) => key[0] === 'github' && overBudget(env, key[1]))
    ? BUDGET_BACKOFF
    : 1;
};

export interface BoardModelHandle {
  getModel(): BoardModel;
  /** Hear every published model; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Re-derive for an edited dashboard, from the cache, at once. */
  setDashboard(dashboard: Dashboard): void;
  /** Re-derive every row (a secret was entered or changed). */
  refresh(): void;
  /** Boost `rowIds`' polling for the user's `kind` of interest (spec
   * 0.2.0 §3.H); a click also polls their root queries at once. */
  attend(rowIds: readonly string[], kind: BoostKind): void;
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
  const attention = createAttention();
  const fetches = createFetchStarts({
    cache: env.client.getQueryCache(),
    now,
    onSlow: (queryHash) => {
      markFed(queryHash);
    },
  });
  const derive: DeriveEnv = {
    client: env.client,
    providers: env.providers,
    budgets: env.budgets,
    now,
    fetchStartedAt: fetches.startedAt,
    boostOf: (rowId) => attention.intervalOf(rowId),
  };
  const rows = new Map<string, RowEntry>();
  const groups = new Map<string, GroupEntry>();
  const dirty = new Set<string>();
  const listeners = new Set<() => void>();
  const observers = createObserverSet(env.client);
  let feeds = new Map<string, Set<string>>();
  const wasOverBudget = new Map<string, boolean>();

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
    // A run one token's cells place isn't unmapped because another
    // token's cells don't (spec.md §3.11).
    const mapped = new Set(all.flatMap((g) => g.mapped));
    model = {
      cells,
      refreshedAt,
      unmapped: unique(
        all.flatMap((g) => g.unmapped),
        (u) => u.id,
      ).filter((u) => !mapped.has(u.id)),
      problems: unique(
        [
          ...[...rows.values()].flatMap((r) => r.derivation.problems),
          ...all.flatMap((g) => g.problems),
        ],
        (p) => p.id,
      ),
      amplifyBranches: all.flatMap((g) => g.branches),
      amplifyKeyApps: keyApps(derive, dashboard),
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
    attention.keep(new Set(byId.keys()));
    for (const rowId of dirty) {
      const before = rows.get(rowId);
      for (const group of before?.groups ?? []) touched.add(group);
      const row = byId.get(rowId);
      if (!row) {
        rows.delete(rowId);
        continue;
      }
      // A boost steps on once its row's root queries have polled.
      if (before && attention.intervalOf(rowId) !== undefined)
        attention.advance(
          rowId,
          rootCompletions(env.client, before.needs),
          now(),
        );
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

  /** Re-derive the rows `queryHash`'s query feeds. */
  const markFed = (queryHash: string) => {
    const fed = feeds.get(queryHash);
    if (!fed) return;
    for (const rowId of fed) dirty.add(rowId);
    schedule();
  };

  const unsubscribeCache = env.client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && !DERIVING_ACTIONS.has(event.action.type))
      return;
    if (event.type !== 'updated' && event.type !== 'removed') return;
    markFed(event.query.queryHash);
  });

  // Budgets publish with the next flush; a token crossing half its
  // budget re-derives its rows (their polling slows or speeds).
  const unsubscribeBudgets = env.budgets.subscribe(() => {
    for (const id of githubCredentialIds(dashboard)) {
      const over = overBudget(env, id);
      if ((wasOverBudget.get(id) ?? false) === over) continue;
      wasOverBudget.set(id, over);
      for (const row of dashboard.rows)
        if (rowCredentials(dashboard, row, 'githubToken').includes(id))
          dirty.add(row.id);
    }
    schedule();
  });

  env.limiters.configure(dashboard);
  markAll();
  flush();
  // The first poll is now, not an interval after a restore (Decision 109).
  pollRootsNow(
    env.client,
    [...rows.values()].flatMap((entry) => entry.needs),
  );

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
    attend(rowIds, kind) {
      if (destroyed) return;
      // A row the board doesn't have (yet) has no root needs to poll; its
      // boost is dropped at the flush.
      const roots = rowIds.flatMap((rowId) => {
        const needs = rows.get(rowId)?.needs ?? [];
        const started = attention.attend(
          rowId,
          kind,
          now(),
          rootCompletions(env.client, needs),
          backoffOf(env, needs),
        );
        if (started) dirty.add(rowId);
        return started ? needs.filter((need) => need.root) : [];
      });
      flush();
      if (kind !== 'click') return;
      pollRootsNow(env.client, roots);
    },
    destroy() {
      destroyed = true;
      attention.clear();
      unsubscribeCache();
      unsubscribeBudgets();
      fetches.destroy();
      observers.destroy();
      listeners.clear();
    },
  };
}
