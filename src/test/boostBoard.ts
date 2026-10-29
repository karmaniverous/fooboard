/**
 * The poll boost's test board (spec 0.2.0 §3.H): three of the demo's rows
 * with nothing in progress at the opening (two GitHub rows and an Amplify
 * row), so they poll at the idle baseline. Every timer and the clock are fake, so TanStack's own
 * interval timers decide when a row polls. Each root query's polls are
 * recorded with the time they started, and responses can be held back
 * (`hold`) to make a poll complete late.
 *
 * @module
 */
import type { Query, QueryClient } from '@tanstack/query-core';
import { vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import { createBoardModel } from '@/engine';
import type { BoardModelHandle } from '@/engine/boardModel';
import type { Transport } from '@/lib/transport';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import { QueryKeySchema } from '@/query/keys';

import { withoutRetryDelay } from './boardModel';
import { simProviders, simTransport } from './simDemo';

/** The wall time the fake clock starts at. */
const START = Date.UTC(2026, 0, 1);

/** How many fake-timer turns a fill may take before the test gives up. */
const FILL_TURNS = 1_000;

const rowOf = (id: string): Row => {
  const row = measureBoard.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

/** The boost board's rows, idle at the opening: two GitHub rows reading
 * different repos, and an Amplify row. */
export const BOOST_ROWS = {
  github: rowOf('mobile-bff'),
  other: rowOf('auth-service'),
  amplify: rowOf('partner-portal'),
};

/** The boost board: the demo's dashboard with only `BOOST_ROWS`, and no
 * row groups (they name the other rows). */
export const boostDashboard: Dashboard = {
  ...measureBoard,
  rows: Object.values(BOOST_ROWS),
  rowGroups: [],
};

/** Is `query` one of `row`'s root queries (a GitHub row's runs pages, an
 * Amplify row's app reads)? */
function isRootOf(row: Row, query: Query): boolean {
  const key = QueryKeySchema.safeParse(query.queryKey);
  if (!key.success) return false;
  const [provider, , request] = key.data;
  if (provider === 'github')
    return row.type === 'github' && request.call === 'runs'
      ? request.repo === row.repo
      : false;
  return (
    row.type === 'amplify' &&
    request.call !== 'apps' &&
    row.pinnedApps.some((pin) => pin.appId === request.appId)
  );
}

/** `row`'s root queries in `client`'s cache that are observed. */
export const rootQueries = (client: QueryClient, row: Row): Query[] =>
  client
    .getQueryCache()
    .getAll()
    .filter((q) => q.getObserversCount() > 0 && isRootOf(row, q));

/** What an observed query's `refetchInterval` is, unless it is a
 * function (the board never sets one). */
export const intervalOf = (query: Query): number | false | undefined => {
  const interval = query.observers.at(0)?.options.refetchInterval;
  return typeof interval === 'function' ? undefined : interval;
};

/** A boost board, read in full under fake timers. */
export interface BoostBoard {
  env: QueryEnv;
  board: BoardModelHandle;
  /** `row`'s root queries that are observed. */
  roots: (row: Row) => Query[];
  /** When each poll of `row`'s first root query started, in ms after
   * `since`. */
  polls: (row: Row, since: number) => number[];
  /** The interval each of `row`'s root queries polls at. */
  intervals: (row: Row) => (number | false | undefined)[];
  /** Hold every response until `release`. */
  hold: () => void;
  release: () => void;
  /** Destroy the board and unmount its client. */
  done: () => void;
}

/** Whether responses are held, and the ones waiting. */
interface Gate {
  held: boolean;
  waiting: (() => void)[];
}

/** A transport whose responses wait while `gate.held`. */
function holding(inner: Transport, gate: Gate): Transport {
  return {
    ...inner,
    fetch: async (input, init) => {
      if (gate.held)
        await new Promise<void>((resolve) => gate.waiting.push(resolve));
      return inner.fetch(input, init);
    },
  };
}

/** Run fake timers due now until nothing is fetching. */
async function drain(env: QueryEnv): Promise<void> {
  for (let turn = 0; turn < FILL_TURNS; turn += 1) {
    await vi.advanceTimersByTimeAsync(0);
    if (env.client.isFetching() === 0) return;
  }
}

/** How long after the fill a test begins: a poll a test starts then
 * completes later than the fill's reads did, as any real poll does. */
const A_MOMENT_MS = 1_000;

/** Fake every timer and the clock, read `dashboard` (the boost board
 * unless given) in full, and, a moment later, record its root queries'
 * polls from then on. */
export async function boostBoard(
  dashboard: Dashboard = boostDashboard,
): Promise<BoostBoard> {
  vi.useFakeTimers({ now: START });
  const gate: Gate = { held: false, waiting: [] };
  const env = withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => simProviders(hooks, holding(simTransport(), gate)),
    }),
  );
  // Mounted, as QueryProvider mounts it: the tab's return refetches.
  env.client.mount();
  const board = createBoardModel({ dashboard, env });
  await drain(env);
  await vi.advanceTimersByTimeAsync(A_MOMENT_MS);
  const started = new Map<string, number[]>();
  env.client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'fetch') return;
    const list = started.get(event.query.queryHash) ?? [];
    list.push(Date.now());
    started.set(event.query.queryHash, list);
  });
  const roots = (row: Row): Query[] => rootQueries(env.client, row);
  return {
    env,
    board,
    roots,
    polls: (row, since) => {
      const first = roots(row).at(0);
      if (!first) throw new Error(`no root query for ${row.id}`);
      return (started.get(first.queryHash) ?? [])
        .filter((at) => at >= since)
        .map((at) => at - since);
    },
    intervals: (row) => roots(row).map(intervalOf),
    hold: () => {
      gate.held = true;
    },
    release: () => {
      gate.held = false;
      for (const resolve of gate.waiting.splice(0)) resolve();
    },
    done: () => {
      board.destroy();
      env.client.unmount();
    },
  };
}
