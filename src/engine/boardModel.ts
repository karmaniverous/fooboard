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
 * While the tab is hidden, rows poll ever more slowly and no boost runs
 * (spec §3.L; `hiddenRamp.ts`). Opening a board polls every row's roots
 * at once (Decision 109).
 * React only subscribes to it.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { rowCredentials } from '@/domain/settings/credentials';
import type { QueryEnv } from '@/query/client';
import type { BoostKind } from '@/query/intervals';
import { tabVisibility, type Visibility } from '@/query/visibility';

import { createAttention } from './attention';
import { rootCompletions } from './completions';
import { createFetchStarts } from './fetchStarts';
import { computeGroup, type GroupEntry, planGroups } from './groups';
import { createHiddenRamps } from './hiddenRamp';
import { keyApps } from './keyApps';
import { buildModel, emptyModel, githubCredentialIds } from './model';
import { createObserverSet, mergeNeeds } from './observers';
import { pollRootsNow } from './pollNow';
import {
  backoffOf,
  type DeriveEnv,
  deriveRow,
  overBudget,
  type RowEntry,
} from './rowDerive';
import { failedRow } from './rowFailure';
import type { BoardModel } from './types';

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
  visibility = tabVisibility,
}: {
  dashboard: Dashboard;
  env: QueryEnv;
  now?: () => number;
  /** Whether the tab is visible (spec §3.L): the tab's own unless given. */
  visibility?: Visibility;
}): BoardModelHandle {
  let dashboard = initial;
  let destroyed = false;
  let scheduled = false;
  let model = emptyModel(githubCredentialIds(dashboard));
  const attention = createAttention();
  const ramps = createHiddenRamps();
  let visible = visibility.isVisible();
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
    // No boost runs while the tab is hidden (spec §3.L).
    boostOf: (rowId) => (visible ? attention.intervalOf(rowId) : undefined),
  };
  const rows = new Map<string, RowEntry>();
  const groups = new Map<string, GroupEntry>();
  const dirty = new Set<string>();
  const listeners = new Set<() => void>();
  const observers = createObserverSet(env.client);
  let feeds = new Map<string, Set<string>>();
  const wasOverBudget = new Map<string, boolean>();

  const publish = () => {
    model = buildModel(rows, [...groups.values()], {
      amplifyKeyApps: keyApps(derive, dashboard),
      budgets: Object.fromEntries(
        githubCredentialIds(dashboard).map((id) => [id, env.budgets.get(id)]),
      ),
    });
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
    ramps.keep(new Set(byId.keys()));
    for (const rowId of dirty) {
      const before = rows.get(rowId);
      for (const group of before?.groups ?? []) touched.add(group);
      const row = byId.get(rowId);
      if (!row) {
        rows.delete(rowId);
        continue;
      }
      // A boost steps on once its row's root queries have polled.
      if (visible && before && attention.intervalOf(rowId) !== undefined)
        attention.advance(
          rowId,
          rootCompletions(env.client, before.needs),
          now(),
        );
      const derived = deriveSafely(row);
      // Hidden, the row polls ever more slowly (spec §3.L).
      const entry = visible
        ? derived
        : ramps.hide(
            rowId,
            derived,
            env.client,
            now(),
            dashboard.settings.hiddenPolling,
          );
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

  // Hiding or showing the tab re-derives every row at its cadence: each
  // ramp starts afresh, and the visible cadence resumes at once.
  const unsubscribeVisibility = visibility.subscribe(() => {
    if (destroyed || visibility.isVisible() === visible) return;
    visible = !visible;
    ramps.clear();
    markAll();
    flush();
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
      if (destroyed || !visible) return;
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
      ramps.clear();
      unsubscribeVisibility();
      unsubscribeCache();
      unsubscribeBudgets();
      fetches.destroy();
      observers.destroy();
      listeners.clear();
    },
  };
}
